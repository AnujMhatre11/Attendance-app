import { Button, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { supabase } from "../utils/supabase";
import { useRouter } from "expo-router";
import { Dispatch, SetStateAction, useContext, useEffect, useState } from "react";
import { fetchSessionData } from "../api/useGetData";
import { UUIDContext } from "../context/uuidContext";
import { UserContext } from "../context/UserContext";
import { UserType } from "../context/UserContext";

WebBrowser.maybeCompleteAuthSession();

const redirectTo = makeRedirectUri({
  scheme: "myapp",
  path: "auth/callback",
});

const createSessionFromUrl = async (
  url: string,
  setUUID: Dispatch<SetStateAction<string | null>>
) => {
  try {
    const hasHashParams = url.includes("#");
    const hasQueryParams = url.includes("?");

    let params: any = {};
    if (hasHashParams) {
      const hashString = url.split("#")[1];
      params = Object.fromEntries(new URLSearchParams(hashString));
    } else if (hasQueryParams) {
      const { params: queryParams, errorCode } = QueryParams.getQueryParams(url);
      if (errorCode) throw new Error(errorCode);
      params = queryParams;
    }

    const { access_token, refresh_token } = params;

    if (!access_token) {
      console.log("No access token found in URL parameters");
      return;
    }

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (error) throw error;

    console.log("Session created successfully");

    if (data) {
      const uuid = await fetchSessionData();
      if (uuid) {
        console.log('uuid assigned')
      } else {
        console.error('uuid assignment failed')
      }
    }

    return data.session;
  } catch (error) {
    console.error("Error creating session:", error);
    throw error;
  }
};

const performOAuth = async (
  router: any,
  setUUID: Dispatch<SetStateAction<string | null>>,
  user: UserType,
  selectedRole: "student" | "faculty"
) => {
  try {
    console.log("Starting OAuth flow with redirect URI:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data?.url) throw new Error("No authorization URL returned from Supabase");

    console.log("Opening auth URL:", data.url);

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo,
      {
        showInRecents: true,
        preferEphemeralSession: true,
      }
    );

    console.log("Auth result:", result);

    if (result.type === "success" && result.url) {
      const session = await createSessionFromUrl(result.url, setUUID);
      if (session) {
        if (selectedRole === 'student') {
          router.push("/components/StudentView");
        } else {
          router.push("/components/TeacherView");
        }
      }
    } else {
      console.log("Authentication was cancelled or failed:", result.type);
    }
  } catch (error) {
    console.error("OAuth error:", error);
  }
};

function Login() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { setUUID } = useContext(UUIDContext);
  const { user, setUser } = useContext(UserContext);
  const [selectedRole, setSelectedRole] = useState<"student" | "faculty" | null>(null);

  useEffect(() => {
    let mounted = true;

    const handleDeepLink = async (url: string) => {
      if (!mounted || !url) return;

      try {
        setIsLoading(true);
        const session = await createSessionFromUrl(url, setUUID);
        if (session && mounted) {
          router.push(selectedRole === 'student' ? "/components/StudentView" : "/components/TeacherView");
        }
      } catch (error) {
        console.error("Deep linking error:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    const subscription = Linking.addEventListener("url", ({ url }) => {
      console.log("Deep link URL:", url);
      handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      console.log("Initial URL:", url);
      if (url) handleDeepLink(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [router, setUUID, selectedRole]);

  const handleRoleSelection = (role: "student" | "faculty") => {
    setSelectedRole(role);
    setUser(prev => ({
      ...prev,
      userRole: role
    }));
  };

  const handleLogin = async () => {
    if (!selectedRole) {
      console.log("No role selected");
      return;
    }

    setIsLoading(true);
    setUser(prev => ({
      ...prev,
      status: "loggedIn"
    }));

    try {
      await performOAuth(router, setUUID, user, selectedRole);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Select Your Role</Text>
      
      <View style={styles.roleContainer}>
        <TouchableOpacity 
          style={[
            styles.roleButton,
            selectedRole === 'student' && styles.selectedRole
          ]}
          onPress={() => handleRoleSelection('student')}
        >
          <Text style={[
            styles.roleText,
            selectedRole === 'student' && styles.selectedRoleText
          ]}>Student</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.roleButton,
            selectedRole === 'faculty' && styles.selectedRole
          ]}
          onPress={() => handleRoleSelection('faculty')}
        >
          <Text style={[
            styles.roleText,
            selectedRole === 'faculty' && styles.selectedRoleText
          ]}>Faculty</Text>
        </TouchableOpacity>
      </View>

      <Button
        onPress={handleLogin}
        title={isLoading ? "Signing in..." : "Sign in with Github"}
        disabled={isLoading || !selectedRole}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  roleContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 30,
    width: "100%",
  },
  roleButton: {
    flex: 1,
    margin: 10,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#007AFF",
    alignItems: "center",
  },
  selectedRole: {
    backgroundColor: "#007AFF",
  },
  roleText: {
    fontSize: 16,
    color: "#007AFF",
  },
  selectedRoleText: {
    color: "white",
  },
});

export default Login;