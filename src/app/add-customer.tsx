import { CustomerForm } from '@/components/CustomerForm';
import { useAppStore } from '@/store/app';
import { router } from 'expo-router';

export default function AddCustomer() {
  const { addCustomer } = useAppStore();
  return <CustomerForm onSave={async (input) => {
    const customer = await addCustomer(input);
    router.replace({ pathname: '/customer-details', params: { id: customer.id } });
  }} />;
}
