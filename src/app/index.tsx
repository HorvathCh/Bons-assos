import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [status, setStatus] = useState('Test de connexion...');

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .order('starts_at')
      .then(({ data, error }) => {
        if (error) setStatus('Erreur : ' + error.message);
        else setStatus(`Connexion OK (${data?.length ?? 0} événements)`);
      });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 18 }}>{status}</Text>
    </View>
  );
}

