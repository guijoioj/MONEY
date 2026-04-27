# app/(cliente)/(tabs)/carrinho.tsx

**Repository:** Mobile
**File:** `app/(cliente)/(tabs)/carrinho.tsx`
**Language:** `tsx`

---

#mobile #source

## Resumo

Arquivo `app/(cliente)/(tabs)/carrinho.tsx` do repositório Mobile.

## Explicacao

Documento exportado automaticamente do LightRAG para consulta no Obsidian.

## Entidades

## Dominios

- [[domains/clientes|clientes]]
- [[domains/produtos|produtos]]
- [[domains/vendas|vendas]]
- [[domains/saloes|saloes]]
- [[domains/sync|sync]]
- [[domains/database|database]]
- [[domains/api|api]]
- [[domains/mobile-ui|mobile-ui]]
- [[domains/state|state]]

Sem entidades vinculadas ainda.

## Arquivos Relacionados

Sem arquivos relacionados ainda.

## Conteudo

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useCarrinhoStore } from '../../../store/carrinhoStore';

type Forma = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro';

const FORMAS: { id: Forma; label: string; icon: string; descricao: string }[] = [
  { id: 'pix', label: 'PIX', icon: 'flash', descricao: 'Aprovação imediata' },
  { id: 'cartao_credito', label: 'Cartão de Crédito', icon: 'card', descricao: 'Até 12x sem juros' },
  { id: 'cartao_debito', label: 'Cartão de Débito', icon: 'card-outline', descricao: 'Débito na hora' },
  { id: 'dinheiro', label: 'Dinheiro', icon: 'cash', descricao: 'Pague na entrega' },
];

function CheckoutModal({
  visible,
  salonId,
  salaoNome,
  totalValor,
  itens,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  salonId: string;
  salaoNome: string;
  totalValor: number;
  itens: any[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [etapa, setEtapa] = useState<'endereco' | 'pagamento' | 'confirmacao' | 'sucesso'>('endereco');
  const [endereco, setEndereco] = useState('');
  const [forma, setForma] = useState<Forma>('pix');
  const [loading, setLoading] = useState(false);

  const formaSelecionada = FORMAS.find(f => f.id === forma)!;

  const handleConfirmar = async () => {
    setLoading(true);
    try {
      await api.post('/app/loja/pedido', {
        salonId,
        itens: itens.map(i => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.preco,
          subtotal: parseFloat((i.preco * i.quantidade).toFixed(2)),
        })),
        enderecoEntrega: endereco.trim(),
        formaPagamento: forma,
      });
      setEtapa('sucesso');
    } catch (err: any) {
      Alert.alert('Erro', err.userMessage ?? 'Não foi possível finalizar o pedido.');
    } finally {
      setLoading(false);
    }
  };

  const resetar = () => {
    setEtapa('endereco');
    setEndereco('');
    setForma('pix');
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: '#f9fafb' }}>

        {etapa === 'sucesso' ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#dcfce7', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Pedido realizado!</Text>
            <Text style={{ fontSize: 14, color: '#6b7280', textAlign: 'center', marginBottom: 8 }}>
              Seu pedido em {salaoNome} foi enviado com sucesso.
            </Text>
            <Text style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 32 }}>
              Pagamento via {formaSelecionada.label} · R$ {totalValor.toFixed(2)}
            </Text>
            <Button label="Acompanhar pedidos" onPress={() => { resetar(); onSuccess(); }} />
          </View>
        ) : (
          <>
            <View style={{ backgroundColor: '#db2777', paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <TouchableOpacity onPress={() => { if (etapa === 'endereco') { resetar(); onClose(); } else if (etapa === 'pagamento') setEtapa('endereco'); else if (etapa === 'confirmacao') setEtapa('pagamento'); }} style={{ marginRight: 12 }}>
                  <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
                  {etapa === 'endereco' ? 'Entrega' : etapa === 'pagamento' ? 'Pagamento' : 'Confirmar Pedido'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 12, gap: 6 }}>
                {(['endereco', 'pagamento', 'confirmacao'] as const).map((e, i) => (
                  <View key={e} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: ['endereco', 'pagamento', 'confirmacao'].indexOf(etapa) >= i ? 'white' : 'rgba(255,255,255,0.3)' }} />
                ))}
              </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">

              {etapa === 'endereco' && (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 }}>Onde entregar?</Text>
                  <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <Ionicons name="location" size={18} color="#db2777" />
                      <Text style={{ marginLeft: 8, fontWeight: '600', color: '#111827' }}>Endereço de entrega</Text>
                    </View>
                    <TextInput
                      style={{ color: '#111827', fontSize: 14, minHeight: 72, textAlignVertical: 'top' }}
                      placeholder="Rua, número, complemento, bairro, cidade..."
                      placeholderTextColor="#9ca3af"
                      value={endereco}
                      onChangeText={setEndereco}
                      multiline
                    />
                  </View>
                  <View style={{ backgroundColor: '#fdf2f8', borderRadius: 12, padding: 14, marginBottom: 24 }}>
                    <Text style={{ fontSize: 13, color: '#9d174d', fontWeight: '600' }}>{salaoNome}</Text>
                    <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{itens.length} {itens.length === 1 ? 'item' : 'itens'} · R$ {totalValor.toFixed(2)}</Text>
                  </View>
                  <Button label="Continuar para pagamento" onPress={() => { if (!endereco.trim()) { Alert.alert('Atenção', 'Informe o endereço de entrega.'); return; } setEtapa('pagamento'); }} />
                </>
              )}

              {etapa === 'pagamento' && (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 }}>Como deseja pagar?</Text>
                  {FORMAS.map(f => (
                    <TouchableOpacity key={f.id} onPress={() => setForma(f.id)} style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 2, borderColor: forma === f.id ? '#db2777' : '#e5e7eb', padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: forma === f.id ? '#fce7f3' : '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <Ionicons name={f.icon as any} size={22} color={forma === f.id ? '#db2777' : '#6b7280'} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700', color: forma === f.id ? '#db2777' : '#111827', fontSize: 15 }}>{f.label}</Text>
                        <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 2 }}>{f.descricao}</Text>
                      </View>
                      {forma === f.id && <Ionicons name="checkmark-circle" size={22} color="#db2777" />}
                    </TouchableOpacity>
                  ))}
                  <View style={{ height: 16 }} />
                  <Button label="Revisar pedido" onPress={() => setEtapa('confirmacao')} />
                </>
              )}

              {etapa === 'confirmacao' && (
                <>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 }}>Resumo do pedido</Text>

                  <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 12 }}>
                    <Text style={{ fontWeight: '700', color: '#111827', marginBottom: 10 }}>{salaoNome}</Text>
                    {itens.map((item: any) => (
                      <View key={item.produtoId} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#374151', fontSize: 13, flex: 1 }} numberOfLines={1}>{item.quantidade}x {item.nome}</Text>
                        <Text style={{ color: '#111827', fontWeight: '600', fontSize: 13, marginLeft: 8 }}>R$ {(item.preco * item.quantidade).toFixed(2)}</Text>
                      </View>
                    ))}
                    <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', marginTop: 8, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: '#111827' }}>Total</Text>
                      <Text style={{ fontWeight: '700', color: '#db2777', fontSize: 18 }}>R$ {totalValor.toFixed(2)}</Text>
                    </View>
                  </View>

                  <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name="location-outline" size={16} color="#6b7280" />
                      <Text style={{ marginLeft: 6, fontWeight: '600', color: '#374151', fontSize: 13 }}>Entrega</Text>
                    </View>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>{endereco}</Text>
                  </View>

                  <View style={{ backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                      <Ionicons name={formaSelecionada.icon as any} size={16} color="#6b7280" />
                      <Text style={{ marginLeft: 6, fontWeight: '600', color: '#374151', fontSize: 13 }}>Pagamento</Text>
                    </View>
                    <Text style={{ color: '#6b7280', fontSize: 13 }}>{formaSelecionada.label}</Text>
                  </View>

                  <Button label={loading ? 'Processando...' : `Confirmar pedido · R$ ${totalValor.toFixed(2)}`} onPress={handleConfirmar} loading={loading} />
                </>
              )}
            </ScrollView>
          </>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CarrinhoScreen() {
  const router = useRouter();
  const { itens, removeItem, updateQuantidade, total, itensPorSalao, limparSalao } = useCarrinhoStore();
  const [checkoutSalonId, setCheckoutSalonId] = useState<string | null>(null);

  const agrupados = itensPorSalao();
  const salaoIds = Object.keys(agrupados);

  if (itens.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <View className="bg-primary pt-14 pb-6 px-6">
          <Text className="text-white text-2xl font-bold">Carrinho</Text>
        </View>
        <View className="flex-1 items-center justify-center">
          <Ionicons name="cart-outline" size={64} color="#e5e7eb" />
          <Text className="text-muted mt-4 text-center">
            Seu carrinho está vazio.{'\n'}Adicione produtos da loja.
          </Text>
        </View>
      </View>
    );
  }

  const salonIdCheckout = checkoutSalonId;
  const itensCheckout = salonIdCheckout ? agrupados[salonIdCheckout] ?? [] : [];
  const salaoNomeCheckout = itensCheckout[0]?.salaoNome ?? '';
  const totalCheckout = salonIdCheckout ? total(salonIdCheckout) : 0;

  return (
    <View className="flex-1 bg-background">
      <View className="bg-primary pt-14 pb-6 px-6">
        <Text className="text-white text-2xl font-bold">Carrinho</Text>
        <Text className="text-pink-200 text-sm mt-1">
          {itens.length} {itens.length === 1 ? 'item' : 'itens'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {salaoIds.map((sId) => {
          const itensSalao = agrupados[sId];
          const salaoNome = itensSalao[0].salaoNome;
          const totalSalao = total(sId);

          return (
            <Card key={sId} className="mb-4">
              <Text className="text-text font-bold text-base mb-3">{salaoNome}</Text>

              {itensSalao.map((item) => (
                <View key={item.produtoId} className="flex-row items-center py-2 border-b border-border">
                  <View className="flex-1">
                    <Text className="text-text text-sm font-medium" numberOfLines={1}>{item.nome}</Text>
                    <Text className="text-primary text-sm font-bold">R$ {item.preco.toFixed(2)}</Text>
                  </View>
                  <View className="flex-row items-center" style={{ gap: 10 }}>
                    <TouchableOpacity onPress={() => updateQuantidade(item.produtoId, item.quantidade - 1)} className="w-7 h-7 bg-gray-100 rounded-full items-center justify-center">
                      <Ionicons name="remove" size={16} color="#374151" />
                    </TouchableOpacity>
                    <Text className="text-text font-bold w-6 text-center">{item.quantidade}</Text>
                    <TouchableOpacity onPress={() => updateQuantidade(item.produtoId, item.quantidade + 1)} className="w-7 h-7 bg-primary rounded-full items-center justify-center">
                      <Ionicons name="add" size={16} color="white" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeItem(item.produtoId)}>
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              <View className="mt-3 pt-3 border-t border-border flex-row justify-between items-center mb-3">
                <Text className="text-text font-bold">Total</Text>
                <Text className="text-primary font-bold text-lg">R$ {totalSalao.toFixed(2)}</Text>
              </View>

              <Button label="Finalizar compra" onPress={() => setCheckoutSalonId(sId)} />
            </Card>
          );
        })}
        <View className="h-8" />
      </ScrollView>

      {salonIdCheckout && (
        <CheckoutModal
          visible={!!salonIdCheckout}
          salonId={salonIdCheckout}
          salaoNome={salaoNomeCheckout}
          totalValor={totalCheckout}
          itens={itensCheckout}
          onClose={() => setCheckoutSalonId(null)}
          onSuccess={() => {
            limparSalao(salonIdCheckout);
            setCheckoutSalonId(null);
            router.push('/(cliente)/(tabs)/meus-pedidos-loja');
          }}
        />
      )}
    </View>
  );
}
```
