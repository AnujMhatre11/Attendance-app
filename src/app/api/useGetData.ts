import { useContext, useState } from "react";
import { supabase } from "../utils/supabase";
import { UUIDContext } from "../context/uuidContext";


const {currentUUID, setCurrentUUID} = useContext(UUIDContext)
console.log("UUID in APIs: ", currentUUID);


// //login 
// export const fetchSessionData = async () => {
//   try {
//     const { data: { session }, error } = await supabase.auth.getSession();
//     if (error) {
//       console.error('Error fetching session:', error.message);
//       return null;
//     }

//     if (session) {
//       const userID = session.user.id;
//       currentUUID = userID //for dynamically fetching
//       // currentUUID = '33333333-3333-3333-3333-333333333333' // for student temp
//       // currentUUID = '22222222-2222-2222-2222-222222222222' // for teacher temp
//       console.log('current uuid, updated from fetchSessionData: ', currentUUID)
//       return userID;
//     } else {
//       console.log('No active session');
//       return null;
//     }
//   } catch (err) {
//     console.error('Unexpected error:', err);
//     return null;
//   }
// };

// studunt view
export const fetchStudentInfo = async () => {
  try {
    // Fetch student information based on UUID
    const { data, error } = await supabase
      .from("student_info")
      .select("*")
      .eq("user_id", currentUUID);


    if (error) {
      console.error("Error fetching student info:", error.message);
      return null;
    }

    if (data && data.length > 0) {
      return data[0];
    } else {
      console.log("No student info found for the given UUID");
      return null;
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return null;
  }
};

// teacher view
export const fetchFacultyInfo = async () => {
  try {
    const { data, error } = await supabase
      .from("faculty")
      .select("*, user_id") // Make sure to select user_id
      .eq("user_id", currentUUID)
      .single();

    if (error) {
      console.log("Error fetching teacher info:", error.message);
      return null;
    }

    if (data) {
      return {
        ...data,
        user_id: data.user_id // Ensure user_id is included
      };
    } else {
      console.log("No faculty info found for the given UUID");
      return null;
    }
  } catch (err) {
    console.error("Unexpected error: ", err);
    return null;
  }
};

// student view
export const getFacultyIdsInSV = async (studentInfo: any) => {
  try {
    const { data: facultyUUIDs, error } = await supabase
      .from('sem_info')
      .select('faculty:faculty_id(user_id)')
      .eq('semester', studentInfo['semester'])
      .eq('branch', studentInfo['branch'])
      .eq('division', studentInfo['division'])
      .eq('batch', studentInfo['batch']);

    if (error) {
      throw new Error(`Error fetching faculty UUIDs: ${error.message}`);
    }

    if (!facultyUUIDs || facultyUUIDs.length === 0) {
      throw new Error('No faculty UUIDs found for the given student info');
    }

    // Extract all user_ids from the nested faculty objects
    const facultyUserIds = facultyUUIDs.map((record) => record.faculty?.user_id).filter(Boolean);

    return facultyUserIds;
  } catch (error) {
    console.error('Error in getFacultyIdsInSV:', error);
    throw error instanceof Error ? error : new Error('An unexpected error occurred');
  }
};


//teacher view 
export const getCourseLectures = async (facultyUUID) => {
  try {
    // Fetch sem_id and student user_ids in a single query using a join
    const { data, error } = await supabase
      .from("sem_info")
      .select(`
        sem_id,
        student_info(user_id)
      `)
      .eq("faculty_id", facultyUUID);

    if (error) {
      throw new Error(`Error fetching course lectures: ${error.message}`);
    }

    if (!data || data.length === 0) {
      throw new Error("No data found for the given faculty UUID");
    }

    // Extract sem_ids and student user_ids from the result
    const semIDs = data.map((record) => record.sem_id);
    const studentList = data
      .flatMap((record) => record.student_info || [])
      .map((student) => student.user_id);

    return { semIDs, studentList };
  } catch (error) {
    console.error("Error in getCourseLectures:", error);
    throw error instanceof Error ? error : new Error("An unexpected error occurred");
  }
};

export const getTeacherSubjects = async (facultyId) => {
  try {
    const { data, error } = await supabase
      .from('sem_info')
      .select(`
        *,
        subject:subject_id (
          subject_id,
          subject_name
        )
      `)
      .eq('faculty_id', facultyId);

    if (error) throw error;

    return data.map(item => ({
      ...item,
      subject_id: item.subject.subject_id,
      subject_name: item.subject.subject_name
    }));
  } catch (err) {
    console.error("Error fetching teacher subjects:", err);
    return [];
  }
};

export const getActiveSessionsForStudent = async (studentInfo) => {
  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .select(`
        *,
        subject:subject_id (subject_name)
      `)
      .eq('semester', studentInfo.semester)
      .eq('branch', studentInfo.branch)
      .eq('division', studentInfo.division)
      .eq('batch', studentInfo.batch)
      .is('end_time', null);

    if (error) throw error;

    console.log("active session data fetched: ", data)

    return data;
  } catch (err) {
    console.error("Error fetching active sessions:", err);
    return [];
  }
};

export const insertStudentUUIDinActiveSessions = async (
  faculty_uuid: string, // Faculty UUID
  student_uuid: string // Student UUID
) => {
  try {
    // Validate input
    if (typeof faculty_uuid !== "string" || typeof student_uuid !== "string") {
      console.log(`Invalid UUID format. Faculty: ${faculty_uuid}, Student: ${student_uuid}`);
    }

    // Fetch the current array for the given faculty_uuid
    const { data: existingData, error: selectError } = await supabase
      .from("active_sessions")
      .select("student_user_id_array")
      .eq("faculty_user_id", faculty_uuid)
      .single();

    if (selectError) throw selectError;

    let updatedArray = []; // Initialize array

    if (existingData?.student_user_id_array) {
      // Append new UUID, avoiding duplicates
      updatedArray = [...existingData.student_user_id_array];
      if (!updatedArray.includes(student_uuid)) {
        updatedArray.push(student_uuid);
      }
    } else {
      // Create a new array if none exists, ensuring proper JSONB format
      updatedArray = JSON.parse(JSON.stringify([student_uuid]));
    }

    // Validate that the array can be properly serialized as JSONB
    try {
      JSON.parse(JSON.stringify(updatedArray));
    } catch (jsonError) {
      console.log(`Invalid UUID format. Faculty: ${faculty_uuid}, Student: ${student_uuid}`); 
    }

    // Update the database
    const { error: updateError } = await supabase
      .from("active_sessions")
      .update({
        student_user_id_array: updatedArray,
      })
      .eq("faculty_user_id", faculty_uuid);

    if (updateError) throw updateError;

    console.log("Updated student_user_id_array successfully:", updatedArray);
    return { success: true, updatedArray };
  } catch (error) {
    console.error("Error Inserting/Updating Data:", error);
    throw error;
  }
};

export const getPresentStudentsFromDB = async (facultyUUID: string )=> {
  try {
    const { data, error } = await supabase
      .from('active_sessions')
      .select('student_user_id_array')
      .eq('faculty_user_id', facultyUUID)

    if (error) throw error;

    console.log("present student  data fetched: ", data)

    return data;
  } catch (err) {
    console.error("Error fetching present:", err);
    return [];
  }
};

export const getAllStudentsFromDB = async (semID: string, faculty_id: string) => {
  try {
    const { data, error } = await supabase
      .from('student_info')
      .select("*")
      .eq('sem_id', semID);
    if (error) throw error;
    console.log("all Students Table Information", data);
    return data;
  } catch (error) {
    console.error("Error fetching students:", error);

  }
}

export const fetchSemId = async (params): Promise<string | null> => {
  try {
    let sem: number = params.semester

    const { data, error } = await supabase
      .from('sem_info')
      .select('sem_id')
      .eq('semester', sem)
      .eq('branch', params.branch)
      .eq('division', params.division)
      .eq('batch', params.batch)
      .eq('subject_id', params.subjectId)
      .eq('faculty_id', params.facultyId)


    if (error) {
      console.error('Error fetching sem_id:', error.message);
      return null;
    }

    if (!data) {
      console.log('No sem_id found for given parameters');
      return null;
    }
    console.log("Sem id from getData :", data[0].sem_id);

    return data[0].sem_id;

  } catch (err) {
    console.error('Unexpected error fetching sem_id:', err);
    return null;
  }
};


export const moveAttendanceToMainTable = async (sessionId, semID, markedStudents) => {
  // Fetch data from active_sessions
  console.log("MARKEDD STUDENTS",markedStudents);
  
  const { data, error } = await supabase
    .from('active_sessions')
    .select('session_id, faculty_user_id, student_user_id_array, start_time, subject_id') // Adjusted fields
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error fetching data from active_sessions:', error);
    return { success: false, error };
  }

  if (!data || data.length === 0) {
    console.warn('No session found with the given session_id:', sessionId);
    return { success: false, message: 'No session found' };
  }

  const sessionData = data[0];
  console.log("pushing data into attendace table: ", sessionData)
  console.log("pushing semID into attendace table: ", semID)

  // Map data to match 
  
  const attendanceData = {
    sem_id: semID, // Assuming subject_id acts as sem_id; adapt as neededs
    session_id: sessionData.session_id,
    faculty_uuid: sessionData.faculty_user_id,
    student_list: markedStudents,
  };

  // Insert into attendance_table
  const { error: insertError } = await supabase
    .from('attendance_table')
    .insert(attendanceData);

  if (insertError) {
    console.error('Error inserting data into attendance_table:', insertError);
    return { success: false, error: insertError };
  }

  return { success: true };
};


// Query 2: Delete session from teacher table
export const deleteSessionFromTeacherTable = async (sessionId) => {
  const { error } = await supabase
    .from('active_sessions') // Replace with the actual teacher table name
    .delete()
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error deleting session from ACTUVE SEESION:', error);
    return { success: false, error };
  }

  return { success: true };
};
