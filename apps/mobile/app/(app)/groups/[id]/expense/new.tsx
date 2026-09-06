import { useLocalSearchParams } from 'expo-router';

import { ExpenseForm } from '@/components/expenses/ExpenseForm';

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return <ExpenseForm groupId={id} expenseId={null} />;
}
