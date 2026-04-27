import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { useCarrinhoStore } from '../../../store/carrinhoStore';
import { Button } from '../../../components/ui/Button';
import { Loading } from '../../../components/ui/Loading';

interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  marca?: string;
  categoria?: string;
  precoVenda: number;
  precoCusto?: number;
  estoque: number;
  estoqueMinimo?: number;
  unidade?: string;
  salonId: string;
  ativo: number;
}

export default function ProdutoPage() {
  const { id, salonId, salaoNome } = useLocalSearchParams<{ id: string; salonId: string; salaoNome: string }>();
  const router = useRouter();
  const { addItem, itens } = useCarrinhoStore();
  const [quantidade, setQuantidade] = useState(1);

  const { data: produtos, isLoading } = useQuery({
    queryKey: ['produtos', salonId],
    queryFn: async () => {
      const res = await api.get(`/app/loja/saloes/${salonId}/produtos`);
      return res.data.data as Produto[];
    },
    enabled: !!salonId,
  });

  const produto = produtos?.find((p) => p.id === id);
  const itemNoCarrinho = itens.find((i) => i.produtoId === id);

  const handleAddToCart = () => {
    if (!produto) return;
    if (produto.estoque <= 0) {
      Alert.alert('Sem estoque', 'Este produto está sem estoque no momento.');
      return;
    }
    addItem({
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.precoVenda,
      quantidade,
      salonId: produto.salonId,
      salaoNome: salaoNome ?? 'Salão',
    });
    Alert.alert(
      'Adicionado ao carrinho!',
      `${quantidade}x ${produto.nome}`,
      [
        { text: 'Continuar comprando', style: 'cancel' },
        { text: 'Ver carrinho', onPress: () => router.push('/(cliente)/(tabs)/carrinho') },
      ]
    );
  };

  if (isLoading) return <Loading fullScreen />;

  if (!produto) {
    return (
      <View style={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.centrado}>
          <Ionicons name="bag-outline" size={56} color="#e5e7eb" />
          <Text style={styles.muted}>Produto não encontrado.</Text>
        </View>
      </View>
    );
  }

  const emEstoque = produto.estoque > 0;
  const estoquebaixo = produto.estoque > 0 && produto.estoqueMinimo && produto.estoque <= produto.estoqueMinimo;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backHero}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.heroIcon}>
            <Ionicons name="bag" size={56} color="white" />
          </View>
          {produto.categoria && (
            <View style={styles.categoriaBadge}>
              <Text style={styles.categoriaTexto}>{produto.categoria.toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.headerProduto}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nomeProduto}>{produto.nome}</Text>
              {produto.marca && (
                <Text style={styles.marca}>{produto.marca}</Text>
              )}
            </View>
            <Text style={styles.preco}>R$ {produto.precoVenda.toFixed(2)}</Text>
          </View>

          <View style={styles.statusRow}>
            <View style={[styles.badge, emEstoque ? styles.badgeVerde : styles.badgeVermelho]}>
              <Ionicons
                name={emEstoque ? 'checkmark-circle' : 'close-circle'}
                size={14}
                color={emEstoque ? '#16a34a' : '#dc2626'}
              />
              <Text style={[styles.badgeTexto, { color: emEstoque ? '#16a34a' : '#dc2626' }]}>
                {emEstoque ? `${produto.estoque} em estoque` : 'Sem estoque'}
              </Text>
            </View>
            {estoquebaixo && (
              <View style={styles.badgeAmarelo}>
                <Ionicons name="warning" size={14} color="#d97706" />
                <Text style={[styles.badgeTexto, { color: '#d97706' }]}>Últimas unidades</Text>
              </View>
            )}
            {produto.unidade && (
              <View style={styles.badgeCinza}>
                <Text style={styles.badgeTexto}>{produto.unidade}</Text>
              </View>
            )}
          </View>

          {produto.descricao && (
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Descrição</Text>
              <Text style={styles.descricao}>{produto.descricao}</Text>
            </View>
          )}

          <View style={styles.secao}>
            <Text style={styles.secaoTitulo}>Informações</Text>
            <View style={styles.infoCard}>
              {produto.marca && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Marca</Text>
                  <Text style={styles.infoValor}>{produto.marca}</Text>
                </View>
              )}
              {produto.categoria && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Categoria</Text>
                  <Text style={styles.infoValor}>{produto.categoria}</Text>
                </View>
              )}
              {produto.unidade && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Unidade</Text>
                  <Text style={styles.infoValor}>{produto.unidade}</Text>
                </View>
              )}
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Disponibilidade</Text>
                <Text style={[styles.infoValor, { color: emEstoque ? '#16a34a' : '#dc2626', fontWeight: '700' }]}>
                  {emEstoque ? 'Disponível' : 'Indisponível'}
                </Text>
              </View>
            </View>
          </View>

          {emEstoque && (
            <View style={styles.secao}>
              <Text style={styles.secaoTitulo}>Quantidade</Text>
              <View style={styles.qtdRow}>
                <TouchableOpacity
                  onPress={() => setQuantidade(q => Math.max(1, q - 1))}
                  style={styles.qtdBtn}
                >
                  <Ionicons name="remove" size={20} color="#374151" />
                </TouchableOpacity>
                <Text style={styles.qtdValor}>{quantidade}</Text>
                <TouchableOpacity
                  onPress={() => setQuantidade(q => Math.min(produto.estoque, q + 1))}
                  style={[styles.qtdBtn, styles.qtdBtnPrimary]}
                >
                  <Ionicons name="add" size={20} color="white" />
                </TouchableOpacity>
                <Text style={styles.qtdTotal}>
                  = R$ {(produto.precoVenda * quantidade).toFixed(2)}
                </Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {itemNoCarrinho && (
          <TouchableOpacity onPress={() => router.push('/(cliente)/(tabs)/carrinho')} style={styles.verCarrinho}>
            <Ionicons name="cart" size={16} color="#db2777" />
            <Text style={styles.verCarrinhoTexto}>{itemNoCarrinho.quantidade} no carrinho</Text>
          </TouchableOpacity>
        )}
        <Button
          label={emEstoque ? `Adicionar ao carrinho — R$ ${(produto.precoVenda * quantidade).toFixed(2)}` : 'Produto esgotado'}
          onPress={handleAddToCart}
          disabled={!emEstoque}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centrado: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { color: '#6b7280', marginTop: 12 },
  backBtn: { padding: 16, paddingTop: 56 },
  hero: { backgroundColor: '#6366f1', paddingTop: 56, paddingBottom: 40, alignItems: 'center' },
  backHero: { position: 'absolute', top: 56, left: 20 },
  heroIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoriaBadge: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  categoriaTexto: { color: 'white', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  body: { padding: 20 },
  headerProduto: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  nomeProduto: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  marca: { fontSize: 14, color: '#6b7280' },
  preco: { fontSize: 24, fontWeight: 'bold', color: '#db2777', marginLeft: 12 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  badgeVerde: { backgroundColor: '#dcfce7' },
  badgeVermelho: { backgroundColor: '#fee2e2' },
  badgeAmarelo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 4 },
  badgeCinza: { backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeTexto: { fontSize: 12, fontWeight: '600' },
  secao: { marginBottom: 20 },
  secaoTitulo: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  descricao: { fontSize: 14, color: '#4b5563', lineHeight: 22 },
  infoCard: { backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  infoLabel: { fontSize: 13, color: '#6b7280' },
  infoValor: { fontSize: 13, color: '#111827', fontWeight: '600' },
  qtdRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtdBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  qtdBtnPrimary: { backgroundColor: '#db2777' },
  qtdValor: { fontSize: 20, fontWeight: 'bold', color: '#111827', minWidth: 32, textAlign: 'center' },
  qtdTotal: { fontSize: 15, fontWeight: '600', color: '#db2777', marginLeft: 4 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 16, paddingBottom: 32, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  verCarrinho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 },
  verCarrinhoTexto: { color: '#db2777', fontWeight: '600', fontSize: 13 },
});
