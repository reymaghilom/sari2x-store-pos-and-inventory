import { createThemedStyles, useAppearance } from '@/store/appearance';
import { radius, spacing, typography } from '@/constants/theme';
import { forwardRef } from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

type FormFieldProps = TextInputProps & { label: string; error?: string };

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField({ label, error, style, multiline, placeholderTextColor, ...props }, ref) {
  const { colors } = useAppearance();
  const styles = useStyles();
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        ref={ref}
        aria-invalid={Boolean(error)}
        multiline={multiline}
        placeholderTextColor={placeholderTextColor ?? colors.textMuted}
        style={[styles.input, multiline && styles.multiline, error && styles.inputError, style]}
        {...props}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
});

const useStyles = createThemedStyles((colors) => ({
  group: { gap: spacing.sm },
  label: { color: colors.text, fontSize: typography.bodySmall, fontWeight: typography.semibold },
  input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface, color: colors.text, fontSize: typography.body },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger, borderWidth: 2, backgroundColor: colors.dangerSoft },
  error: { color: colors.danger, fontSize: typography.bodySmall },
}));
