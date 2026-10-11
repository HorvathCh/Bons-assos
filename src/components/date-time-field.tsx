import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, useColorScheme, View } from 'react-native';

import { Txt, useTheme } from '@/components/ui';
import { formatDay, formatTime } from '@/lib/events';

type Props = {
  label: string;
  value: Date;
  mode: 'date' | 'time';
  onChange: (value: Date) => void;
  minimumDate?: Date;
  maximumDate?: Date;
};

/** A labelled row with the platform's own date or time picker. */
export function DateTimeField({ label, value, mode, onChange, minimumDate, maximumDate }: Props) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [open, setOpen] = useState(false);

  // Android pickers are dialogs: the row shows the value and opens the dialog on tap.
  if (Platform.OS === 'android') {
    return (
      <View style={styles.row}>
        <Txt>{label}</Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => setOpen(true)}
          style={[styles.value, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Txt>{mode === 'date' ? formatDay(value) : formatTime(value)}</Txt>
        </Pressable>
        {open ? (
          <DateTimePicker
            value={value}
            mode={mode}
            is24Hour
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            positiveButton={{ label: 'OK' }}
            negativeButton={{ label: 'Annuler' }}
            onValueChange={(_event, selected) => {
              setOpen(false);
              onChange(selected);
            }}
            onDismiss={() => setOpen(false)}
          />
        ) : null}
      </View>
    );
  }

  // iOS shows a compact value that opens a calendar or a time wheel.
  return (
    <View style={styles.row}>
      <Txt>{label}</Txt>
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        locale="fr-FR"
        themeVariant={colorScheme === 'dark' ? 'dark' : 'light'}
        minimumDate={minimumDate}
        maximumDate={maximumDate}
        accentColor={theme.primary}
        onValueChange={(_event, selected) => onChange(selected)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  value: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
});
