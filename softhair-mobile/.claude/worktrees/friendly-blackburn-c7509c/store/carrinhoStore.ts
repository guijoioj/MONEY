import { create } from 'zustand';

export interface CarrinhoItem {
  produtoId: string;
  nome: string;
  preco: number;
  quantidade: number;
  salonId: string;
  salaoNome: string;
}

interface CarrinhoState {
  itens: CarrinhoItem[];
  addItem: (item: CarrinhoItem) => void;
  removeItem: (produtoId: string) => void;
  updateQuantidade: (produtoId: string, quantidade: number) => void;
  limparCarrinho: () => void;
  limparSalao: (salonId: string) => void;
  total: (salonId?: string) => number;
  itensPorSalao: () => Record<string, CarrinhoItem[]>;
}

export const useCarrinhoStore = create<CarrinhoState>((set, get) => ({
  itens: [],

  addItem: (novoItem) => {
    set((state) => {
      const existente = state.itens.find(
        (i) => i.produtoId === novoItem.produtoId,
      );
      if (existente) {
        return {
          itens: state.itens.map((i) =>
            i.produtoId === novoItem.produtoId
              ? { ...i, quantidade: i.quantidade + novoItem.quantidade }
              : i,
          ),
        };
      }
      return { itens: [...state.itens, novoItem] };
    });
  },

  removeItem: (produtoId) => {
    set((state) => ({
      itens: state.itens.filter((i) => i.produtoId !== produtoId),
    }));
  },

  updateQuantidade: (produtoId, quantidade) => {
    if (quantidade <= 0) {
      get().removeItem(produtoId);
      return;
    }
    set((state) => ({
      itens: state.itens.map((i) =>
        i.produtoId === produtoId ? { ...i, quantidade } : i,
      ),
    }));
  },

  limparCarrinho: () => set({ itens: [] }),

  limparSalao: (salonId) => {
    set((state) => ({
      itens: state.itens.filter((i) => i.salonId !== salonId),
    }));
  },

  total: (salonId) => {
    const { itens } = get();
    const filtrados = salonId
      ? itens.filter((i) => i.salonId === salonId)
      : itens;
    return filtrados.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  },

  itensPorSalao: () => {
    const { itens } = get();
    return itens.reduce(
      (acc, item) => {
        if (!acc[item.salonId]) acc[item.salonId] = [];
        acc[item.salonId].push(item);
        return acc;
      },
      {} as Record<string, CarrinhoItem[]>,
    );
  },
}));
