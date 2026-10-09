import { useEffect, useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';

export default function Home() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .order('starts_at')
      .then(({ data, error }) => {
        if (error) console.error(error.message);
        else setEvents(data ?? []);
      });
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
      <Text style={{ fontSize: 18 }}>{status}</Text>
    </View>
  );
}
