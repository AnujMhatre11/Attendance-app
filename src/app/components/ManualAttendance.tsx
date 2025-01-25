import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { getPresentStudentsFromDB, getAllStudentsFromDB, fetchSemId } from '../api/useGetData';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '../utils/supabase';
import bleService from '../backend/bleSetup';
import { moveAttendanceToMainTable, deleteSessionFromTeacherTable } from '../api/useGetData';

interface ManualAttendanceProps {
  facultyId: string;
}

type RouteParams = {
  sessionId: string;
  uuid: string;  // Added missing type
}

interface AttendanceRecord {  // Added missing interface
  user_id: string;
  name: string;
  prn: string;
  status: 'Present' | 'Absent';
}

const ManualAttendance: React.FC<ManualAttendanceProps> = ({ facultyId }) => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [semId, setSemId] = useState<string | null>(null);
  const [markedStudents, setMarkedStudents] = useState<string[]>([]);
  const params = useLocalSearchParams<RouteParams>();
  const ble = bleService();

  useEffect(() => {
    const getSemId = async () => {
      try {
        // Ensure params.uuid exists before calling fetchSemId
        if (!params.uuid) {
          throw new Error('Session UUID is undefined');
        }
        const id = await fetchSemId(params);
        setSemId(id);
        if (id) {
          await initializeAttendance(id);
        }
      } catch (err) {
        setError('Failed to fetch semester ID');
        console.error('Error fetching semId:', err);
      }
    };
    
    const initializeAttendance = async (currentSemId: string) => {
      try {
        setLoading(true);
        const [allStudents, presentData] = await Promise.all([
          getAllStudentsFromDB(currentSemId, facultyId),
          getPresentStudentsFromDB(params.uuid!)
        ]);
    
        const presentStudentIds = presentData?.[0]?.student_user_id_array || [];
        setMarkedStudents(presentStudentIds);

        const initialAttendance = allStudents?.map(student => ({
          ...student,
          status: presentStudentIds.includes(student.user_id) ? 'Present' : 'Absent'
        })) || [];
    
        setAttendance(initialAttendance);
      } catch (err) {
        setError('Failed to load attendance data');
        console.error('Error loading attendance:', err);
      } finally {
        setLoading(false);
      }
    };
    
    getSemId();
  }, [facultyId, params.uuid]);

  const handleStatusChange = (userId: string, status: 'Present' | 'Absent'): void => {
    setAttendance((prev) =>
      prev.map((student) =>
        student.user_id === userId ? { ...student, status } : student
      )
    );

    if (status === 'Present') {
      setMarkedStudents(prev => [...new Set([...prev, userId])]);
    } else {
      setMarkedStudents(prev => prev.filter(id => id !== userId));
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is undefined');
      }
      
      const moveResult = await moveAttendanceToMainTable(sessionId, semId, markedStudents);
      if (!moveResult.success) {
        throw new Error(moveResult.error || moveResult.message || 'Failed to move attendance data');
      }
  
      const deleteResult = await deleteSessionFromTeacherTable(sessionId);
      if (!deleteResult.success) {
        throw new Error(deleteResult.error || 'Failed to delete session');
      }
    } catch (error) {
      console.error('Error handling session end:', error);
      throw error; // Propagate error to caller
    }
  };

  const endSession = async (currentSessionId: string) => {
    console.log(markedStudents);
    
    console.log(params.sessionId);
    
    console.log(currentSessionId);
    
    if (!currentSessionId) {
      Alert.alert('Error', 'Invalid session ID');
      return;
    }

    try {
      await supabase
        .from('active_sessions')
        .update({ end_time: new Date().toISOString() })
        .eq('session_id', currentSessionId);

      if (markedStudents.length > 0) {
        await supabase.from('attendance_table').insert({
          session_id: currentSessionId,
          date: new Date().toISOString(),
          student_list: markedStudents,
        });
      }

      await ble.stopAdvertising();
      await ble.cleanup();
      await handleEndSession(currentSessionId);
      
      // Add navigation or success feedback here
      Alert.alert('Success', 'Session ended successfully');
    } catch (error) {
      console.error('Error ending session:', error);
      Alert.alert('Error', 'Failed to save attendance data');
    }
  };

  const renderItem = ({ item }: { item: AttendanceRecord }) => (
    <View style={styles.studentRow}>
      <View style={styles.studentInfo}>
        <Text style={styles.studentName}>{item.name}</Text>
        <Text style={styles.studentPrn}>PRN: {item.prn}</Text>
      </View>
      <View style={styles.buttonGroup}>
        <TouchableOpacity
          style={[
            styles.statusButton,
            item.status === 'Present' && styles.presentButton,
          ]}
          onPress={() => handleStatusChange(item.user_id, 'Present')}
        >
          <Text style={styles.buttonText}>Present</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.statusButton,
            item.status === 'Absent' && styles.absentButton,
          ]}
          onPress={() => handleStatusChange(item.user_id, 'Absent')}
        >
          <Text style={styles.buttonText}>Absent</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Loading attendance data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Manual Attendance</Text>
      {attendance.length === 0 ? (
        <Text style={styles.message}>No students found</Text>
      ) : (
        <>
          <FlatList
            data={attendance}
            keyExtractor={(item) => item.user_id}
            renderItem={renderItem}
            style={styles.list}
          />
          <TouchableOpacity 
            style={styles.commitButton}
            onPress={() => endSession(params.sessionId)}  
          >
            <Text style={styles.commitButtonText}>Commit Attendance</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f9f9f9',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  list: {
    flex: 1,
    marginBottom: 16,
  },
  studentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '500',
  },
  studentPrn: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  buttonGroup: {
    flexDirection: 'row',
  },
  statusButton: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    marginHorizontal: 4,
    minWidth: 80,
    alignItems: 'center',
  },
  presentButton: {
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  absentButton: {
    backgroundColor: '#dc3545',
    borderColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  message: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
  },
  errorMessage: {
    textAlign: 'center',
    fontSize: 16,
    color: '#dc3545',
  },
  commitButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  commitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default ManualAttendance;