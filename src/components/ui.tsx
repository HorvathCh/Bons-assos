import type { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
  type TextInputProps,
  type TextProps,
} from 'react-native';

const palette = {
  light: {
    background: '#ffffff',
    surface: '#F0F0F3',
    border: '#D9D9E0',
    text: '#11181C',
    textSecondary: '#60646C',
    primary: '#208AEF',
    onPrimary: '#ffffff',
    danger: '#D92D20',
    success: '#16794C',
  },
  dark: {
    background: '#000000',
    surface: '#212225',
    border: '#3A3C40',
    text: '#ffffff',
    textSecondary: '#B0B4BA',
    primary: '#4BA3F5',
    onPrimary: '#000000',
    danger: '#FF6B5E',
    success: '#4CC38A',
  },
} as const;

export function useTheme() {
  return palette[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export function Screen({ children }: PropsWithChildren) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

type TxtProps = TextProps & { variant?: 'title' | 'heading' | 'body' | 'secondary' };

export function Txt({ variant = 'body', style, ...props }: TxtProps) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles[variant],
        { color: variant === 'secondary' ? theme.textSecondary : theme.text },
        style,
      ]}
      {...props}
    />
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <Txt variant="secondary">{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.surface },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

export const emailFieldProps = {
  autoCapitalize: 'none',
  autoCorrect: false,
  keyboardType: 'email-address',
  autoComplete: 'email',
  textContentType: 'emailAddress',
} satisfies TextInputProps;

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', loading, disabled, compact }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;
  const color =
    variant === 'primary' ? theme.onPrimary : variant === 'danger' ? theme.danger : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        variant === 'primary'
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { borderColor: variant === 'danger' ? theme.danger : theme.border },
        (pressed || inactive) && styles.dimmed,
      ]}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <Text style={[styles.buttonLabel, { color }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Notice({ kind, children }: PropsWithChildren<{ kind: 'error' | 'success' }>) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[styles.body, { color: kind === 'error' ? theme.danger : theme.success }]}>
      {children}
    </Text>
  );
}

export function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>;
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.loading, { backgroundColor: theme.background }]}>
      <ActivityIndicator />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 20,
    gap: 16,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  secondary: { fontSize: 14, lineHeight: 20 },
  field: { gap: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: 12 },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  dimmed: { opacity: 0.6 },
  card: { borderRadius: 12, padding: 16, gap: 12 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
