import { CustomerForm } from '@/components/CustomerForm';
import { PlaceholderScreen } from '@/components/PlaceholderScreen';
import { useAppStore } from '@/store/app';
import { router, useLocalSearchParams } from 'expo-router';

export default function EditCustomer() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { customers, updateCustomer } = useAppStore();
  const customer = customers.find((item) => item.id === id);
  if (!customer) return <PlaceholderScreen title="Customer not found" description="Return to Customers and select an available profile." />;
  return <CustomerForm customer={customer} onSave={async (input) => {
    await updateCustomer(customer.id, input);
    router.replace({ pathname: '/customer-details', params: { id: customer.id } });
  }} />;
}
