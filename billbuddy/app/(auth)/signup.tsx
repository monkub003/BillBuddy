import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { useAuth } from "@/hooks/useAuth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const { signup, loading, error } = useAuth();

  const handleSignup = () => {
    setValidationError(null);

    if (!EMAIL_REGEX.test(email)) {
      setValidationError("Please enter a valid email address");
      return;
    }

    if (password.length < 8) {
      setValidationError("Password must be at least 8 characters");
      return;
    }

    signup(email, password);
  };

  const displayError = validationError ?? error;

  return (
    <View className="flex-1 justify-center px-6 bg-white">
      <Text className="text-3xl font-bold text-center mb-8">
        Create Account
      </Text>

      {displayError ? (
        <Text className="text-red-500 text-center mb-4">{displayError}</Text>
      ) : null}

      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        accessibilityLabel="Email"
      />

      <TextInput
        className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base"
        placeholder="Password (min 8 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        accessibilityLabel="Password"
      />

      <TouchableOpacity
        className="bg-blue-600 rounded-lg py-3 items-center mb-4"
        onPress={handleSignup}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Sign up"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-base">Sign Up</Text>
        )}
      </TouchableOpacity>

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity className="items-center" accessibilityRole="link">
          <Text className="text-blue-600">
            Already have an account? Log In
          </Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}
