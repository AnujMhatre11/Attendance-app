import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import bleService from '../backend/bleSetup';
import { supabase } from '../utils/supabase';

type RouteParams = {
  facultyUuid: string; // Changed from facultyId
  subjectName: string;
  subjectId: string;
  student_uuid: string;
};

const StudentMarkingAttendance = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const params = useLocalSearchParams<RouteParams>();
  const router = useRouter();
  const ble = bleService();

  // Check for active session
  useEffect(() => {
    const checkActiveSession = async () => {
      try {
        const { data, error } = await supabase
          .from('active_sessions')
          .select('*')
          .eq('faculty_user_id', params.facultyUuid)
          .eq('subject_id', params.subjectID)
          .is('end_time', null);
    
        if (error) {
          console.error('Error checking active session:', error);
          return;
        }
    
        console.log('Active session data:', data);
    
        if (data && data.length == 1) {
          setActiveSession(data[0]);
        } else if (data.length > 1) {
          console.error('Multiple active sessions found. Expected one.');
        } else {
          setActiveSession(null); // No active session found
        }
      } catch (error) {
        console.error('Error checking active session:', error);
      }
    };
    

    const interval = setInterval(checkActiveSession, 5000); // Check every 5 seconds
    checkActiveSession(); // Initial check

    return () => {
      clearInterval(interval);
      if (isScanning) {
        ble.stopScanning();
      }
    };
  }, [params.facultyId, params.subjectId]);

  const handleAttendance = async () => {
    try {
      setIsLoading(true);

      if (!activeSession) {
        Alert.alert("No Active Session", "There is no active attendance session at the moment.");
        return;
      }

      if (!isScanning) {
        const hasPermissions = await ble.requestPermissions();
        if (!hasPermissions) {
          Alert.alert("Permission Error", "Bluetooth permissions required");
          return;
        }
        
        
        const startScan = await ble.startScanning(params.facultyUuid, params.student_uuid); // Changed to use UUID
        if (!startScan) {
          throw new Error('Failed to start scanning');
        }

        setIsScanning(true);
        Alert.alert("Scanning", "Looking for teacher's device...");
      } else {
        await ble.stopScanning();
        setIsScanning(false);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert("Error", "Failed to mark attendance");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle session end
  useEffect(() => {
    if (isScanning && !activeSession) {
      ble.stopScanning();
      setIsScanning(false);
      Alert.alert("Session Ended", "The attendance session has ended.");
    }
  }, [activeSession, isScanning]);

  const deleteEndedSession = async (sessionId: string) => {
    try {
      // First, copy the session data to a history table if needed
      const { data: sessionData } = await supabase
        .from('active_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (sessionData) {
        // You might want to create a sessions_history table and insert the data there
        await supabase
          .from('active_sessions')
          .delete()
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error('Error deleting ended session:', error);
    }
  };

  useEffect(() => {
    if (activeSession) {
      console.log('Session is active:', activeSession);
    } else {
      console.log('No active session');
    }
  }, [activeSession]);
  

  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mark Attendance</Text>
      <Text style={styles.subjectName}>{params.subjectName}</Text>

      {activeSession ? (
        <Text style={styles.sessionStatus}>Session Active</Text>
      ) : (
        <Text style={styles.sessionStatus}>Waiting for session...</Text>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          isScanning && styles.activeButton,
          (!activeSession || isLoading) && styles.disabledButton
        ]}
        onPress={handleAttendance}
        disabled={!activeSession || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>
            {isScanning ? 'Cancel' : 'Mark Attendance'}
          </Text>
        )}
      </TouchableOpacity>

      {isScanning && (
        <Text style={styles.scanningText}>
          Scanning for teacher's device...
        </Text>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  subjectName: {
    fontSize: 18,
    color: '#666',
    marginBottom: 16,
  },
  sessionStatus: {
    fontSize: 16,
    color: '#444',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#FF3B30',
  },
  disabledButton: {
    backgroundColor: '#999',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scanningText: {
    marginTop: 16,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
  },
});

export default StudentMarkingAttendance;