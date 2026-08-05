import { create } from 'zustand';
import type { Tab, TabType } from '../types';

interface TabStore {
  tabs: Tab[];
  activeTabId: string | null;
  
  // Actions
  addTab: (tab: Omit<Tab, 'id'>) => string;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  closeTabsToTheRight: (id: string) => void;
  closeTabsForDatabase: (connectionId: string, database: string) => void;
  closeTabsForConnection: (connectionId: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  setTabModified: (id: string, isModified: boolean) => void;
  moveTab: (fromIndex: number, toIndex: number) => void;
  getTabById: (id: string) => Tab | undefined;
  getActiveTab: () => Tab | undefined;
}

const DATABASE_DEPENDENT_TAB_TYPES: ReadonlySet<TabType> = new Set<TabType>([
  'tableList',
  'viewList',
  'functionList',
  'tableData',
  'viewData',
  'designer',
  'viewDesigner',
  'functionDesigner',
]);

const generateTabId = () => `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

/** 连接依赖型 tab（除数据库依赖型外，还有仅依赖连接的用户管理 tab）。 */
const isConnectionDependentTab = (type: TabType): boolean =>
  DATABASE_DEPENDENT_TAB_TYPES.has(type) || type === 'userManager' || type === 'userEditor';

/**
 * 计算关闭一批 tab 后的 tabs 与 activeTabId（与 closeTab 的相邻选中语义一致）。
 */
const computeTabsAfterClose = (
  tabs: Tab[],
  activeTabId: string | null,
  idsToClose: Set<string>,
): { tabs: Tab[]; activeTabId: string | null } => {
  if (idsToClose.size === 0) return { tabs, activeTabId };

  const newTabs = tabs.filter((t) => !idsToClose.has(t.id));
  let newActiveId = activeTabId;
  if (activeTabId && idsToClose.has(activeTabId)) {
    const closedIndex = tabs.findIndex((t) => t.id === activeTabId);
    if (newTabs.length > 0) {
      newActiveId = newTabs[Math.min(closedIndex, newTabs.length - 1)]?.id || null;
    } else {
      newActiveId = null;
    }
  }
  return { tabs: newTabs, activeTabId: newActiveId };
};

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  
  addTab: (tab) => {
    const id = generateTabId();
    const newTab = { ...tab, id };
    
    set((state) => {
      // 查询标签页（query）总是新建
      if (tab.type === 'query') {
        return {
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        };
      }
      
      // 视图数据标签页（viewData）可以打开多个不同的视图，每个视图一个tab
      if (tab.type === 'viewData') {
        const existingTab = state.tabs.find((t) => 
          t.type === tab.type && 
          t.connectionId === tab.connectionId && 
          t.database === tab.database && 
          t.objectName === tab.objectName
        );
        
        if (existingTab) {
          return { activeTabId: existingTab.id };
        }
        
        return {
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        };
      }
      
      // 表数据标签页（tableData）可以打开多个不同的表，每个表一个tab
      if (tab.type === 'tableData') {
        const existingTab = state.tabs.find((t) => 
          t.type === tab.type && 
          t.connectionId === tab.connectionId && 
          t.database === tab.database && 
          t.table === tab.table
        );
        
        if (existingTab) {
          return { activeTabId: existingTab.id };
        }
        
        return {
          tabs: [...state.tabs, newTab],
          activeTabId: id,
        };
      }
      
      // 其他类型的标签页（如列表页、设计器等）
      const existingTab = state.tabs.find((t) => 
        t.type === tab.type && 
        t.connectionId === tab.connectionId && 
        t.database === tab.database && 
        t.table === tab.table &&
        t.objectName === tab.objectName
      );
      
      if (existingTab) {
        return { activeTabId: existingTab.id };
      }
      
      return {
        tabs: [...state.tabs, newTab],
        activeTabId: id,
      };
    });
    
    return id;
  },
  
  closeTab: (id) => {
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;
      
      if (state.activeTabId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        if (newTabs.length > 0) {
          newActiveId = newTabs[Math.min(closedIndex, newTabs.length - 1)]?.id || null;
        } else {
          newActiveId = null;
        }
      }
      
      return { tabs: newTabs, activeTabId: newActiveId };
    });
  },
  
  closeOtherTabs: (id) => {
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    }));
  },
  
  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },
  
  closeTabsToTheRight: (id) => {
    set((state) => {
      const index = state.tabs.findIndex((t) => t.id === id);
      if (index === -1) return state;
      
      const newTabs = state.tabs.slice(0, index + 1);
      return {
        tabs: newTabs,
        activeTabId: state.activeTabId && newTabs.find((t) => t.id === state.activeTabId) 
          ? state.activeTabId 
          : id,
      };
    });
  },

  // 关闭数据库时连带关闭其依赖 tab
  closeTabsForDatabase: (connectionId, database) => {
    set((state) => {
      const idsToClose = new Set(
        state.tabs
          .filter(
            (t) =>
              t.connectionId === connectionId &&
              t.database === database &&
              DATABASE_DEPENDENT_TAB_TYPES.has(t.type),
          )
          .map((t) => t.id),
      );
      return computeTabsAfterClose(state.tabs, state.activeTabId, idsToClose);
    });
  },

  // 关闭连接时连带关闭依赖该连接的所有 tab
  closeTabsForConnection: (connectionId) => {
    set((state) => {
      const idsToClose = new Set(
        state.tabs
          .filter(
            (t) =>
              t.connectionId === connectionId &&
              isConnectionDependentTab(t.type),
          )
          .map((t) => t.id),
      );
      return computeTabsAfterClose(state.tabs, state.activeTabId, idsToClose);
    });
  },
  
  setActiveTab: (id) => {
    set({ activeTabId: id });
  },
  
  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    }));
  },
  
  setTabModified: (id, isModified) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, isModified } : t
      ),
    }));
  },
  
  moveTab: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [movedTab] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, movedTab);
      return { tabs: newTabs };
    });
  },
  
  getTabById: (id) => {
    return get().tabs.find((t) => t.id === id);
  },
  
  getActiveTab: () => {
    const { tabs, activeTabId } = get();
    return tabs.find((t) => t.id === activeTabId);
  },
}));
