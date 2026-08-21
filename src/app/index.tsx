import { useAuth } from '@/store/auth';
import { Redirect } from 'expo-router';
export default function Index() { const { user } = useAuth(); return <Redirect href={user ? '/(tabs)' : '/login'} />; }
