import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

type Product = {
  id: string;
  title?: string;
  sellerName?: string;
  price?: { amount: number; currency: string };
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/products?locale=mn&currency=MNT`)
      .then((response) => {
        if (!response.ok) throw new Error(`API ${response.status}`);
        return response.json();
      })
      .then((payload) => setProducts(payload.products || []))
      .catch((err) => setError(err.message || "API error"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.logo}>ExpoCraft</Text>
        <Text style={styles.subtitle}>Монгол гар урлалын mobile demo</Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#b4533a" />
      ) : error ? (
        <Text style={styles.error}>API холболт амжилтгүй: {error}</Text>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.meta}>{item.sellerName}</Text>
              <Text style={styles.price}>
                {item.price?.amount?.toLocaleString()} {item.price?.currency}
              </Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#faf7f2"
  },
  header: {
    padding: 24,
    gap: 6
  },
  logo: {
    color: "#221c15",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 2
  },
  subtitle: {
    color: "#6f6355",
    fontSize: 14
  },
  list: {
    padding: 16,
    gap: 12
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#e7dfd3",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 6
  },
  title: {
    color: "#221c15",
    fontSize: 17,
    fontWeight: "700"
  },
  meta: {
    color: "#6f6355",
    fontSize: 13
  },
  price: {
    color: "#b4533a",
    fontSize: 15,
    fontWeight: "700"
  },
  error: {
    margin: 24,
    color: "#b91c1c"
  }
});
