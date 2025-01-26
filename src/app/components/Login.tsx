import React, { useState, useEffect, useContext } from 'react';
import { Button, View, Text, Alert } from 'react-native';
import axios from 'axios';
import { authorize } from 'react-native-app-auth';
import { useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import { UUIDContext } from '../context/uuidContext';

const AuthScreen = () => {
  const [authState, setAuthState] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const router = useRouter();
  const {UUID, setUUID} = useContext(UUIDContext);

  const fetchAuthDetails = async () => {
    try {
      console.log('Fetching OAuth details from server...');
      const response = await axios.post('https://its-siesgst-auth.onrender.com/auth/startOAuthFlowApp', {});
      const { clientId } = response.data;
      console.log('Received OAuth details:', { clientId });
      setClientId(clientId);
      return { clientId };
    } catch (error) {
      console.error('Error fetching OAuth details:', error);
      Alert.alert('Error', 'Failed to fetch OAuth details');
      throw error;
    }
  };

  const handleLogin = async () => {
    try {
      console.log(`Initiating login process for ${userRole}...`);
      let oauthDetails = { clientId };
      if (!clientId) {
        console.log('Missing OAuth details. Fetching before login...');
        oauthDetails = await fetchAuthDetails();
      }

      const config = {
        serviceConfiguration: {
          authorizationEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
          tokenEndpoint: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        },
        clientId: oauthDetails.clientId,
        redirectUrl: 'com.anonymous.authtest.auth://oauth',
        scopes: ['openid', 'profile', 'email'],
        usePKCE: true,
        skipCodeExchange: false,
      };

      console.log('Authorization configuration:', config);
      const result = await authorize(config);
      console.log('Full Authorization Result:', result);

      if (!result.idToken) {
        throw new Error('No idToken received');
      }

      const { idToken } = result;
      const decodedToken = jwtDecode(idToken);
      const { email } = decodedToken;

      if (!email) {
        throw new Error('Email not found in the idToken');
      }

      console.log('Email extracted from idToken:', email);
      const verificationResponse = await axios.post(
        'https://its-siesgst-auth.onrender.com/auth/verifyAuthCode',
        { email }
      );

      console.log('Verification response:', verificationResponse.data);

      if (verificationResponse.data.status === 'success') {
        console.log('Login successful');
        setAuthState(verificationResponse.data);
        Alert.alert('Success', 'Login successful');
        
        setUUID(verificationResponse.data.authId)
        console.log("Auth ID in context: ", UUID)
        // Navigate based on user role
        if (userRole === 'teacher') {
          router.push('/components/TeacherView');
        } else if (userRole === 'student') {
          router.push('/components/StudentView');
        }
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Detailed OAuth login error:', {
        errorMessage: error.message,
        serverResponse: error.response?.data,
        fullError: error,
      });
      Alert.alert(
        'Login Error',
        error.response?.data?.error || error.message || 'An unexpected error occurred'
      );
    }
  };

  useEffect(() => {
    console.log('Component mounted. Fetching initial OAuth details.');
    fetchAuthDetails();
  }, []);

  return (
    <View>
      <Text>Welcome to the app!</Text>
      {!userRole && (
        <View>
          <Button
            title="Login as Teacher"
            onPress={() => {
              setUserRole('teacher');
              handleLogin();
            }}
          />
          <Button
            title="Login as Student"
            onPress={() => {
              setUserRole('student');
              handleLogin();
            }}
          />
        </View>
      )}
      {authState && (
        <View>
          <Text>User ID: {authState.uid}</Text>
          <Text>Auth ID: {authState.authId}</Text>
        </View>
      )}
    </View>
  );
};

export default AuthScreen;