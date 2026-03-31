import React from "react";
import { View, Text, FlatList } from "react-native";
import { Expense } from "@/types";

interface Props {
  expenses: Expense[];
}

export function UpcomingBills({ expenses }: Props) {
  const unpaid = expenses
    .filter((e) => !e.isPaid)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  if (unpaid.length === 0) {
    return (
      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="text-base font-semibold text-gray-800 mb-2">
          Upcoming Bills
        </Text>
        <Text className="text-sm text-gray-400 text-center py-4">
          No unpaid bills
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-xl p-4 mb-4">
      <Text className="text-base font-semibold text-gray-800 mb-2">
        Upcoming Bills
      </Text>
      <FlatList
        data={unpaid}
        scrollEnabled={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="flex-row justify-between items-center py-2 border-b border-gray-50">
            <View>
              <Text className="text-sm font-medium text-gray-800 capitalize">
                {item.category}
              </Text>
              <Text className="text-xs text-gray-400">
                Due: {new Date(item.dueDate).toLocaleDateString()}
              </Text>
            </View>
            <Text className="text-sm font-semibold text-red-600">
              ฿{item.amount.toLocaleString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
