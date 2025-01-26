import React, { useState, useCallback, useEffect, useContext } from 'react';
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
  const { UUID, setUUID } = useContext(UUIDContext);

  const fetchAuthDetails = useCallback(async () => {
    try {
      const response = await axios.post('https://its-siesgst-auth.onrender.com/auth/startOAuthFlowApp', {});
      const { clientId } = response.data;
      setClientId(clientId);
      return { clientId };
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch OAuth details');
      throw error;
    }
  }, []);

  const handleLogin = async (role) => {
    try {
      // Set the role before proceeding with login
      setUserRole(role);

      let oauthDetails = { clientId };
      if (!clientId) {
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

      const result = await authorize(config);

      if (!result.idToken) {
        throw new Error('No idToken received');
      }

      const decodedToken = jwtDecode(result.idToken);
      const { email } = decodedToken;

      if (!email) {
        throw new Error('Email not found in the idToken');
      }

      const verificationResponse = await axios.post(
        'https://its-siesgst-auth.onrender.com/auth/verifyAuthCode',
        { email }
      );

      if (verificationResponse.data.status === 'success') {
        setAuthState(verificationResponse.data);
        
        const authId = verificationResponse.data.authId;
        setUUID(authId);
        console.log("Auth ID:", authId);

        if (role === 'teacher') {
          router.push({
            pathname: '/components/TeacherView',
            params: { uuidParam: authId }
          });
        } else if (role === 'student') {
          router.push({
            pathname: '/components/StudentView', 
            params: { uuidParam: authId }
          });
        }
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('Detailed OAuth login error:', error);
      Alert.alert(
        'Login Error',
        error.response?.data?.error || error.message || 'An unexpected error occurred'
      );
    }
  };

  useEffect(() => {
    fetchAuthDetails();
  }, [fetchAuthDetails]);

  useEffect(() => {
    console.log("effect called, UUID in context: ", UUID)
  }, [UUID])

  return (
    <View>
      <Text>Welcome to the app!</Text>
      {!userRole && (
        <View>
          <Button
            title="Login as Teacher"
            onPress={() => handleLogin('teacher')}
          />
          <Button
            title="Login as Student"
            onPress={() => handleLogin('student')}
          />
        </View>
      )}
    </View>
  );
};

export default AuthScreen;