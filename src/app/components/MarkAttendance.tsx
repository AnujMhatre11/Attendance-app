import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Alert, 
  NativeEventEmitter, 
  NativeModules,
  ActivityIndicator 
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import bleService from '../backend/bleSetup';
import { supabase } from '../utils/supabase';
import { moveAttendanceToMainTable, deleteSessionFromTeacherTable, fetchSemId } from '../api/useGetData';

type RouteParams = {
  facultyId: string;
  uuid: string;
  courseName: string;
  subjectId: string;
  semester: string;
  branch: string;
  division: string;
  batch: string;
};

type Student = {
  uuid: string;
  timestamp: string;
};

const MarkAttendance = () => {
  const params = useLocalSearchParams<RouteParams>();
  const router = useRouter();
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [markedStudents, setMarkedStudents] = useState<Student[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [semID, setSemID] = useState("");
  const ble = bleService();

  useEffect(() => {
    if (!params.uuid) {
      console.error('No UUID provided');
      Alert.alert('Error', 'Invalid session parameters');
      router.back();
      return;
    }
    

    const eventEmitter = new NativeEventEmitter(NativeModules.BLEAdvertiser);
    const foundUuidListener = eventEmitter.addListener('foundUuid', (data) => {
      if (data) {
        console.log('Student detected:', data);
        markStudentAttendance(data); // Mark the student's attendance
      }
    });

    return () => {
      foundUuidListener.remove();

    };
  }, [params.uuid, isSessionActive]);

  useEffect(() => {
    const getData = async () => {
      try {
        const temp = await fetchSemId(params);
        if(temp) {

          setSemID(temp);
        } else {
          console.error("Error fetchin seester id in mark attendace")
        }
      } catch (error) {
        console.error("Error fetching SEM ID:", error);
      }
    };
  
    getData();
  }, [params]);

  const markStudentAttendance = (studentUuid: string) => {
    setMarkedStudents((prev) => {
      if (prev.some((student) => student.uuid === studentUuid)) {
        console.log(`Attendance already marked for student: ${studentUuid}`);
        return prev;
      }
      const newStudent = { uuid: studentUuid, timestamp: new Date().toISOString() };
      console.log(`Attendance marked for student: ${studentUuid}`);
      return [...prev, newStudent];
    });
  };

  const startSessionInDB = async () => {
    try {
      const { data, error } = await supabase.from('active_sessions').insert({
        faculty_user_id: params.uuid, // This should now be the actual UUID
        subject_id: params.subjectId,
        branch: params.branch,
        semester: parseInt(params.semester), // Convert to number
        division: params.division,
        batch: params.batch,
        session_name: `${params.courseName} (${params.branch} - ${params.semester} - ${params.division})`,
      }).select();

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('No session data returned');

      console.log('Session created:', data[0]);
      setCurrentSessionId(data[0].session_id);
      return data[0].session_id;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      // Step 1: Move attendance data
      const moveResult = await moveAttendanceToMainTable(sessionId, semID);
      if (!moveResult.success) {
        console.error('Failed to move attendance data:', moveResult.error || moveResult.message);
        return;
      }
  
      console.log('Attendance data successfully moved.');
  
      // Step 2: Delete session
      const deleteResult = await deleteSessionFromTeacherTable(sessionId);
      if (!deleteResult.success) {
        console.error('Failed to delete session:', deleteResult.error);
        return;
      }
  
      console.log('Session successfully deleted.');
    } catch (error) {
      console.error('Error handling session end:', error);
    }
  };

  const endSession = async () => {
    try {
      if (currentSessionId) {
        // Update session end time
        await supabase
          .from('active_sessions')
          .update({ end_time: new Date().toISOString() })
          .eq('session_id', currentSessionId);
  
        // Insert attendance data if students are marked
        if (markedStudents.length > 0) {
          await supabase.from('attendance_table').insert({
            session_id: currentSessionId,
            date: new Date().toISOString(),
            student_list: markedStudents.map((student) => student.uuid),
          });
        }
      }
  
      // Stop BLE services
      await ble.stopAdvertising();
      await ble.cleanup();
  
      // Handle session end (move and delete data)
      await handleEndSession(currentSessionId);
    } catch (error) {
      console.error('Error ending session:', error);
      Alert.alert('Error', 'Failed to save attendance data');
    }
  };
  
  const handleMarkAttendance = async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      if (!isSessionActive) {
        const hasPermissions = await ble.requestPermissions();
        if (!hasPermissions) {
          Alert.alert('Permission Error', 'Bluetooth permissions required.');
          return;
        }

        const sessionId = await startSessionInDB();
        if (!sessionId) {
          throw new Error('Failed to create session');
        }

        await ble.startAdvertising(params.uuid);
        setIsSessionActive(true);
        Alert.alert('Session Started', 'Students can now mark attendance.');
      } else {
        await endSession();
        setIsSessionActive(false);
        Alert.alert(
          'Session Ended',
          `Attendance marked for ${markedStudents.length} students.`,
        );
      }
    } catch (error) {
      console.error('Error during session:', error);
      Alert.alert('Error', 'Failed to manage the attendance session.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToManualAttendance = () => {
    router.push({
      pathname: '/components/ManualAttendance',
      params: {
        facultyId: params.facultyId,
        uuid: params.uuid,
        courseName: params.courseName,
        subjectId: params.subjectId,
        semester: params.semester,
        branch: params.branch,
        division: params.division,
        batch: params.batch,
        sessionId: currentSessionId,
      }
    });
  };

  if (!params.uuid) {
    return (
      <View style={styles.container}>
        <Text>Invalid session parameters</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{params.courseName}</Text>
        <Text style={styles.subHeader}>
          {`Branch: ${params.branch} | Sem: ${params.semester} | Div: ${params.division}`}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          isSessionActive && styles.activeButton,
          isLoading && styles.disabledButton,
        ]}
        onPress={handleMarkAttendance}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.buttonText}>
            {isSessionActive ? 'Stop Session' : 'Start Session'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.manualButton]}
        onPress={navigateToManualAttendance}
      >
        <Text style={styles.buttonText}>Manual Attendance</Text>
      </TouchableOpacity>

      <View style={styles.studentsContainer}>
        {/* <Text style={styles.studentsHeader}>
          {`Marked Students: ${markedStudents.length}`}
        </Text> */}
        {markedStudents.map((student, index) => (
          <View key={student.uuid} style={styles.studentRow}>
            <Text style={styles.studentText}>
              {`${index + 1}. ${student.uuid}`}
            </Text>
            <Text style={styles.timestampText}>
              {new Date(student.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  header: { 
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  headerText: { 
    fontSize: 20, 
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subHeader: {
    fontSize: 14,
    color: '#666',
  },
  button: { 
    padding: 16, 
    backgroundColor: '#007AFF', 
    borderRadius: 8,
    elevation: 2,
    marginBottom: 12,
  },
  activeButton: { 
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    opacity: 0.7,
  },
  buttonText: { 
    color: '#FFF', 
    textAlign: 'center',
    fontWeight: 'bold',
  },
  manualButton: {
    backgroundColor: '#4CAF50',
  },
  studentsContainer: {
    marginTop: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  studentsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  studentText: {
    flex: 1,
    fontSize: 14,
  },
  timestampText: {
    fontSize: 12,
    color: '#666',
  },
});

export default MarkAttendance;
