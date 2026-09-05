import { useLocalSearchParams } from 'expo-router';

import { ExpenseForm } from '@/components/expenses/ExpenseForm';

export default function EditExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();

  return <ExpenseForm groupId={id} expenseId={expenseId} />;
}
