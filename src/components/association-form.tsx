import { useState } from 'react';

import { DateTimeField } from '@/components/date-time-field';
import { Button, emailFieldProps, Field, Notice, Screen, Txt } from '@/components/ui';
import { dayFromIso, dayToIso, type AssociationDetails } from '@/lib/memberships';

/** Everything the form edits; the phone is the only optional contact detail. */
export type AssociationFormValues = Omit<AssociationDetails, 'id'>;

type Props = {
  initial?: AssociationDetails;
  intro?: string;
  submitLabel: string;
  /** Saves the association. Returns an error message, or null once saved. */
  onSubmit: (values: AssociationFormValues) => Promise<string | null>;
};

export function AssociationForm({ initial, intro, submitLabel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [presidentName, setPresidentName] = useState(initial?.president_name ?? '');
  const [contactEmail, setContactEmail] = useState(initial?.contact_email ?? '');
  const [contactPhone, setContactPhone] = useState(initial?.contact_phone ?? '');
  const [hqAddress, setHqAddress] = useState(initial?.hq_address ?? '');
  const [foundedOn, setFoundedOn] = useState(() =>
    initial?.founded_on ? dayFromIso(initial.founded_on) : null
  );
  const [employees, setEmployees] = useState(initial?.employee_count?.toString() ?? '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    // The button stays active so that a tap always says what is missing.
    const missing = [
      [name, 'le nom de l’association'],
      [presidentName, 'le nom du président'],
      [contactEmail, 'l’email de contact'],
      [hqAddress, 'l’adresse du siège'],
      [employees, 'le nombre de salariés (0 s’il n’y en a pas)'],
    ].find(([value]) => !value.trim());
    if (missing) {
      setError(`Indiquez ${missing[1]}.`);
      return;
    }
    if (!foundedOn) {
      setError('Indiquez la date de création de l’association.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) {
      setError('L’email de contact n’est pas une adresse valide.');
      return;
    }
    if (!/^\d+$/.test(employees.trim())) {
      setError('Le nombre de salariés doit être un nombre entier.');
      return;
    }

    setError('');
    setSubmitting(true);
    const message = await onSubmit({
      name: name.trim(),
      description: description.trim(),
      president_name: presidentName.trim(),
      contact_email: contactEmail.trim(),
      contact_phone: contactPhone.trim() || null,
      hq_address: hqAddress.trim(),
      employee_count: Number(employees.trim()),
      founded_on: dayToIso(foundedOn),
    });
    if (message) {
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {intro ? <Txt variant="secondary">{intro}</Txt> : null}
      <Field label="Nom de l’association" value={name} onChangeText={setName} />
      <Field
        label="Description (facultatif)"
        value={description}
        onChangeText={setDescription}
        multiline
      />
      {foundedOn ? (
        <DateTimeField
          label="Date de création"
          mode="date"
          value={foundedOn}
          maximumDate={new Date()}
          onChange={setFoundedOn}
        />
      ) : (
        <Button
          title="Indiquer la date de création"
          variant="secondary"
          onPress={() => setFoundedOn(new Date())}
        />
      )}
      <Field
        label="Président"
        value={presidentName}
        onChangeText={setPresidentName}
        autoComplete="name"
        textContentType="name"
      />
      <Field
        label="Email de contact"
        value={contactEmail}
        onChangeText={setContactEmail}
        {...emailFieldProps}
      />
      <Field
        label="Téléphone de contact (facultatif)"
        value={contactPhone}
        onChangeText={setContactPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
      />
      <Field
        label="Adresse du siège"
        value={hqAddress}
        onChangeText={setHqAddress}
        multiline
        autoComplete="street-address"
        textContentType="fullStreetAddress"
      />
      <Field
        label="Nombre de salariés"
        value={employees}
        onChangeText={setEmployees}
        keyboardType="number-pad"
        placeholder="0"
      />
      <Notice kind="error">{error}</Notice>
      <Button title={submitLabel} onPress={submit} loading={submitting} />
    </Screen>
  );
}
