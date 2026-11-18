'use client';

import { useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  HashtagIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import api, { ApiError } from '@/lib/api';
import { buildNavGroups, canAccessNavKey, type NavBuildOptions } from '@/lib/navigation';
import { formatDocumentoCliente, formatMoney } from '@/lib/utils';

type Icon = ComponentType<{ className?: string }>;

type PaletteItem = {
  id: string;
  section: string;
  label: string;
  hint?: string;
  icon: Icon;
  href: string;
  keywords?: string;
};

type ClienteBusca = {
  id: number;
  razaoSocial: string;
  nomeFantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
  cidade?: string | null;
};

type VendaPorOrdem = {
  id: number;
  numeroVenda?: number | null;
  valorTotal: number | string;
  cliente?: { razaoSocial: string; nomeFantasia?: string | null };
};

/** Remove acentos e caixa para comparar termos digitados. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function matchesQuery(item: { label: string; keywords?: string; section?: string }, query: string) {
  const q = normalizeSearch(query);
  if (!q) return true;
  const hay = normalizeSearch(`${item.label} ${item.keywords ?? ''} ${item.section ?? ''}`);
  return q.split(/\s+/).every((part) => hay.includes(part));
}

/** "#12", "12", "ordem 12" → 12. */
export function parseOrdemQuery(query: string): number | null {
  const m = query.trim().match(/^(?:#|ordem\s*#?\s*)?(\d{1,9})$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  nav: NavBuildOptions;
};

export function CommandPalette({ open, onClose, nav }: CommandPaletteProps) {
  const router = useRouter();
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [clientes, setClientes] = useState<ClienteBusca[]>([]);
  const [venda, setVenda] = useState<VendaPorOrdem | null>(null);
  const [buscando, setBuscando] = useState(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  const perm = useCallback(
    (key: Parameters<typeof canAccessNavKey>[0]) =>
      canAccessNavKey(key, { isAdmin: nav.isAdmin, navPermissions: nav.navPermissions ?? null }),
    [nav.isAdmin, nav.navPermissions],
  );

  const baseItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [];
    if (perm('vendas')) {
      actions.push({ id: 'a-venda', section: 'Ações', label: 'Nova venda', icon: PlusIcon, href: '/vendas/nova', keywords: 'criar ordem pedido' });
    }
    if (perm('financeiro')) {
      actions.push({ id: 'a-receber', section: 'Ações', label: 'Receber pagamento', icon: ArrowDownTrayIcon, href: '/financeiro/novo', keywords: 'baixa pix cheque dinheiro' });
    }
    if (perm('clientes')) {
      actions.push({ id: 'a-cliente', section: 'Ações', label: 'Novo cliente', icon: PlusIcon, href: '/clientes/novo', keywords: 'cadastrar cnpj' });
    }
    if (perm('produtos')) {
      actions.push({ id: 'a-produto', section: 'Ações', label: 'Novo produto', icon: PlusIcon, href: '/produtos?novo=1', keywords: 'cadastrar' });
    }
    const pages: PaletteItem[] = buildNavGroups(nav).flatMap((g) =>
      g.items.map((i) => ({
        id: `p-${i.href}`,
        section: 'Ir para',
        label: i.label,
        hint: g.label,
        icon: i.icon,
        href: i.href,
        keywords: i.keywords,
      })),
    );
    return [...actions, ...pages];
  }, [nav, perm]);

  const ordem = parseOrdemQuery(query);
  const termo = query.trim();

  // Busca remota (debounce) — só em módulos que o usuário pode acessar.
  useEffect(() => {
    if (!open) return;
    setClientes([]);
    setVenda(null);
    const podeOrdem = ordem != null && perm('vendas');
    const podeClientes = ordem == null && termo.length >= 2 && perm('clientes');
    if (!podeOrdem && !podeClientes) {
      setBuscando(false);
      return;
    }
    let cancelled = false;
    setBuscando(true);
    const t = window.setTimeout(() => {
      const req = podeOrdem
        ? api
            .get<VendaPorOrdem>(`/vendas/por-ordem/${ordem}`)
            .then((v) => !cancelled && setVenda(v))
            .catch((e) => {
              if (!(e instanceof ApiError && e.status === 404)) console.warn('[busca] ordem', e);
            })
        : api
            .get<{ clientes: ClienteBusca[] }>(
              `/clientes?busca=${encodeURIComponent(termo)}&take=6`,
            )
            .then((r) => !cancelled && setClientes(r?.clientes ?? []))
            .catch(() => !cancelled && setClientes([]));
      void req.finally(() => !cancelled && setBuscando(false));
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, ordem, termo, perm]);

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];
    if (venda) {
      const nome = venda.cliente?.nomeFantasia || venda.cliente?.razaoSocial || '';
      out.push({
        id: `v-${venda.id}`,
        section: 'Ordem',
        label: `Ordem #${venda.numeroVenda ?? venda.id}`,
        hint: `${nome} · ${formatMoney(venda.valorTotal)}`,
        icon: HashtagIcon,
        href: `/vendas/${venda.id}`,
      });
    }
    for (const c of clientes) {
      out.push({
        id: `c-${c.id}`,
        section: 'Clientes',
        label: c.nomeFantasia || c.razaoSocial,
        hint: [formatDocumentoCliente(c), c.cidade].filter((x) => x && x !== "—").join(' · '),
        icon: UserGroupIcon,
        href: `/clientes/${c.id}`,
      });
    }
    out.push(...baseItems.filter((i) => matchesQuery(i, query)));
    return out;
  }, [venda, clientes, baseItems, query]);

  useEffect(() => {
    setActive(0);
  }, [query, venda, clientes.length]);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = prevOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(item.href);
  };

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(items[active]);
    } else if (e.key === 'Tab') {
      // Foco permanece no campo; a lista é navegada por setas.
      e.preventDefault();
    }
  };

  if (!open) return null;

  let lastSection = '';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-gray-950/40 p-4 pt-[12vh] backdrop-blur-[2px] animate-fade-in"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Busca e comandos"
        className="w-full max-w-xl overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-gray-950/10 animate-pop-in"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-gray-200 px-4">
          <MagnifyingGlassIcon className="h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          <label htmlFor={inputId} className="sr-only">
            Buscar
          </label>
          <input
            ref={inputRef}
            id={inputId}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, ordem (#12) ou tela…"
            className="h-14 w-full bg-transparent text-[15px] text-gray-900 placeholder:text-gray-400 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            data-enter-nav="skip"
          />
          {buscando ? (
            <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-blue-700" aria-hidden="true" />
          ) : (
            <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
          )}
        </div>

        <ul id={listId} ref={listRef} role="listbox" aria-label="Resultados" className="max-h-[min(60vh,26rem)] overflow-y-auto p-2">
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-sm text-gray-500" role="presentation">
              {buscando ? 'Buscando…' : 'Nada encontrado. Tente o nome do cliente, CNPJ ou número da ordem.'}
            </li>
          ) : (
            items.map((item, index) => {
              const header = item.section !== lastSection ? item.section : null;
              lastSection = item.section;
              const Icon = item.icon;
              const selected = index === active;
              return (
                <li key={item.id} role="presentation">
                  {header ? (
                    <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400" aria-hidden="true">
                      {header}
                    </p>
                  ) : null}
                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                    data-index={index}
                    onMouseMove={() => setActive(index)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => go(item)}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                      selected ? 'bg-blue-50 text-blue-950' : 'text-gray-700'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-blue-700' : 'text-gray-400'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                    {item.hint ? (
                      <span className="hidden max-w-[50%] truncate text-xs text-gray-500 sm:block">{item.hint}</span>
                    ) : null}
                    {selected ? <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden="true" /> : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="flex items-center gap-4 border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> navegar
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">Enter</kbd> abrir
          </span>
          <span className="ml-auto hidden sm:block">Dica: digite o número da ordem para abri-la direto</span>
        </div>
      </div>
    </div>
  );
}
