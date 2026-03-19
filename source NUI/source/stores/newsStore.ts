
import { createStore } from 'solid-js/store';
import { fetchNui } from '~/utils/fetchNui';

export type NewsGrade = 'REPORTER' | 'EDITOR' | 'CHIEF_EDITOR' | 'DIRECTOR';
export type NewsCategory = 'BREAKING' | 'POLICE' | 'EMS' | 'COMMUNITY' | 'TRAFFIC' | 'WEATHER' | 'OFFICIAL';
export type NewsPriority = 1 | 2 | 3 | 4 | 5;
export type NewsStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED';

export interface NewsImage {
  imageId: string;
  url: string;
  caption?: string;
  order: number;
}

export interface NewsAttachment {
  attachmentId: string;
  filename: string;
  url: string;
  type: 'PDF' | 'DOC' | 'IMAGE' | 'VIDEO' | 'OTHER';
}

export interface NewsParagraph {
  paragraphId: string;
  order: number;
  type: 'TEXT' | 'QUOTE' | 'FACT_BOX';
  content: string;
}

export interface NewsAuthor {
  id: string;
  name: string;
  grade: NewsGrade;
  badge?: string;
}

export interface NewsArticle {
  articleId: string;
  headline: string;
  subheadline?: string;
  category: NewsCategory;
  priority: NewsPriority;
  location?: string;

  author: NewsAuthor;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  expiresAt?: string;

  lead: string;
  paragraphs: NewsParagraph[];
  conclusion?: string;

  featuredImage?: NewsImage;
  gallery: NewsImage[];
  attachments: NewsAttachment[];
  tags: string[];
  relatedCaseId?: string;

  status: NewsStatus;
  isPinned: boolean;
  viewCount: number;
  shareCode: string;
}

export interface NewsDraft {
  headline: string;
  lead: string;
  category: NewsCategory;
  featuredImageUrl: string;
}

export interface NewsState {
  articles: Record<string, NewsArticle>;
  currentUser: {
    id: string;
    name: string;
    grade: NewsGrade;
    badge?: string;
  } | null;
  filters: {
    category: NewsCategory | null;
    status: NewsStatus | null;
    searchQuery: string;
  };
  selectedArticle: string | null;
  editingArticle: string | null;
  draft: NewsDraft;
}

const initialDraft: NewsDraft = {
  headline: '',
  lead: '',
  category: 'COMMUNITY',
  featuredImageUrl: '',
};

const initialState: NewsState = {
  articles: {},
  currentUser: null,
  filters: {
    category: null,
    status: null,
    searchQuery: ''
  },
  selectedArticle: null,
  editingArticle: null,
  draft: { ...initialDraft },
};

export const [newsState, setNewsState] = createStore<NewsState>(initialState);

const CATEGORY_PRIORITY: Record<NewsCategory, NewsPriority> = {
  BREAKING: 1,
  OFFICIAL: 2,
  POLICE: 3,
  EMS: 3,
  COMMUNITY: 3,
  TRAFFIC: 4,
  WEATHER: 5,
};

function generateShareCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateId(): string {
  return `NEWS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const expirationTimers = new Map<string, number>();

function scheduleExpiration(articleId: string, expiresAt: string) {
  const expiresTime = new Date(expiresAt).getTime();
  const now = Date.now();
  const delay = expiresTime - now;

  if (delay > 0) {
    const timerId = window.setTimeout(() => {
      newsActions.expireArticle(articleId);
    }, delay);
    expirationTimers.set(articleId, timerId);
  }
}

function clearExpiration(articleId: string) {
  const timerId = expirationTimers.get(articleId);
  if (timerId) {
    window.clearTimeout(timerId);
    expirationTimers.delete(articleId);
  }
}

export const newsActions = {
  setCurrentUser(user: NewsState['currentUser']) {
    setNewsState('currentUser', user);
  },

  setDraft(updates: Partial<NewsDraft>) {
    setNewsState('draft', prev => ({ ...prev, ...updates }));
  },

  resetDraft() {
    setNewsState('draft', { ...initialDraft });
    setNewsState('editingArticle', null);
  },

  quickPublish(headline: string, lead: string, category: NewsCategory, featuredImageUrl?: string): NewsArticle | null {
    if (!headline.trim() || !lead.trim()) return null;

    const articleId = generateId();
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setHours(expiresAt.getHours() + 24);
    const priority = CATEGORY_PRIORITY[category] || 3;

    const article: NewsArticle = {
      articleId,
      headline: headline.trim().substring(0, 140),
      category,
      priority: priority as NewsPriority,
      author: newsState.currentUser || {
        id: 'UNKNOWN',
        name: 'Desconocido',
        grade: 'REPORTER',
      },
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      publishedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lead: lead.trim().substring(0, 2000),
      paragraphs: [],
      gallery: [],
      attachments: [],
      tags: [],
      featuredImage: featuredImageUrl
        ? { imageId: `IMG_${Date.now()}`, url: featuredImageUrl, order: 0 }
        : undefined,
      status: 'PUBLISHED',
      isPinned: false,
      viewCount: 0,
      shareCode: generateShareCode(),
    };

    setNewsState('articles', articleId, article);
    scheduleExpiration(articleId, expiresAt.toISOString());
    this.emitNewsEvent('published', articleId);
    this.resetDraft();
    return article;
  },

  prefillFromDispatch(callData: { title: string; description: string; type?: string }) {
    const categoryMap: Record<string, NewsCategory> = {
      SHOOTING: 'BREAKING',
      ROBBERY: 'BREAKING',
      PURSUIT: 'BREAKING',
      EMERGENCY: 'BREAKING',
      ACCIDENT: 'TRAFFIC',
      TRAFFIC_STOP: 'TRAFFIC',
      MEDICAL: 'EMS',
      FIRE: 'EMS',
      POLICE_ASSISTANCE: 'POLICE',
    };
    const category = categoryMap[callData.type?.toUpperCase() || ''] || 'COMMUNITY';

    setNewsState('draft', {
      headline: callData.title.substring(0, 140),
      lead: callData.description.substring(0, 2000),
      category,
      featuredImageUrl: '',
    });
    setNewsState('editingArticle', null);
  },

  updateArticle(articleId: string, updates: Partial<NewsArticle>, options?: { emitEvent?: boolean }) {
    setNewsState('articles', articleId, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    if (options?.emitEvent !== false) {
      this.emitNewsEvent('updated', articleId);
    }
  },

  publishArticle(articleId: string) {
    const article = newsState.articles[articleId];
    if (!article) return;

    const now = new Date();
    const wasPublished = article.status === 'PUBLISHED';
    const publishedAt = article.publishedAt || now.toISOString();
    const nextExpiresAt = (() => {
      if (article.expiresAt) {
        return article.expiresAt;
      }

      const expiration = new Date(now);
      expiration.setHours(expiration.getHours() + 24);
      return expiration.toISOString();
    })();

    this.updateArticle(articleId, {
      status: 'PUBLISHED',
      publishedAt,
      expiresAt: nextExpiresAt,
    }, { emitEvent: false });

    if (nextExpiresAt) {
      clearExpiration(articleId);
      scheduleExpiration(articleId, nextExpiresAt);
    }

    this.emitNewsEvent(wasPublished ? 'updated' : 'published', articleId);
  },

  expireArticle(articleId: string) {
    this.updateArticle(articleId, { status: 'EXPIRED' }, { emitEvent: false });
    this.emitNewsEvent('expired', articleId);
  },

  archiveArticle(articleId: string) {
    clearExpiration(articleId);
    this.updateArticle(articleId, { status: 'ARCHIVED' });
  },

  deleteArticle(articleId: string) {
    this.emitNewsEvent('deleted', articleId);
    clearExpiration(articleId);
    setNewsState('articles', articleId, undefined as any);
  },

  togglePin(articleId: string) {
    const article = newsState.articles[articleId];
    if (article) {
      this.updateArticle(articleId, { isPinned: !article.isPinned });
    }
  },

  incrementViews(articleId: string) {
    const article = newsState.articles[articleId];
    if (article) {
      setNewsState('articles', articleId, 'viewCount', article.viewCount + 1);
    }
  },

  setFilters(filters: Partial<NewsState['filters']>) {
    setNewsState('filters', prev => ({ ...prev, ...filters }));
  },

  selectArticle(articleId: string | null) {
    setNewsState('selectedArticle', articleId);
  },

  startEditing(articleId: string | null) {
    setNewsState('editingArticle', articleId);
  },

  emitNewsEvent(event: 'published' | 'updated' | 'expired' | 'deleted', articleId: string) {
    const article = newsState.articles[articleId];
    if (!article) return;

    if (typeof window !== 'undefined') {
      fetchNui(`cad:news:${event}`, {
        articleId,
        article,
        headline: article.headline,
        category: article.category,
        priority: article.priority,
        shareCode: article.shareCode,
        preview: article.lead.substring(0, 100),
        timestamp: new Date().toISOString()
      }).catch(console.error);
    }

    window.dispatchEvent(new CustomEvent(`news:${event}`, {
      detail: { articleId, article }
    }));
  },

  async loadFromServer() {
    try {
      const response = await fetchNui<{
        ok: boolean;
        articles?: NewsArticle[];
      }>('cad:news:getArticles', {});

      if (!response?.ok || !Array.isArray(response.articles)) {
        return false;
      }

      const mapped: Record<string, NewsArticle> = {};
      for (let i = 0; i < response.articles.length; i += 1) {
        const article = response.articles[i];
        if (!article || typeof article.articleId !== 'string' || article.articleId.trim() === '') {
          continue;
        }

        mapped[article.articleId] = article;
      }

      setNewsState('articles', mapped);

      Object.values(mapped).forEach((article) => {
        if (article.status === 'PUBLISHED' && article.expiresAt) {
          scheduleExpiration(article.articleId, article.expiresAt);
        }
      });

      return true;
    } catch {
      return false;
    }
  },

  getArticleByShareCode(code: string): NewsArticle | undefined {
    return Object.values(newsState.articles).find(a => a.shareCode === code);
  },
};

if (typeof window !== 'undefined') {
  let lastPersistedPayload = '';

  const persistNewsState = () => {
    const payload = JSON.stringify({
      articles: newsState.articles,
    });

    if (payload === lastPersistedPayload) {
      return;
    }

    localStorage.setItem('cad_news', payload);
    lastPersistedPayload = payload;
  };

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem('cad_news');
    if (!saved) {
      return;
    }

    try {
      const parsed = JSON.parse(saved);
      setNewsState('articles', parsed.articles || {});
      lastPersistedPayload = saved;

      const articles = parsed.articles as Record<string, NewsArticle>;
      Object.values(articles || {}).forEach((article) => {
        if (article.status === 'PUBLISHED' && article.expiresAt) {
          scheduleExpiration(article.articleId, article.expiresAt);
        }
      });
    } catch (e) {
      console.error('[NewsStore] Failed to load saved news:', e);
    }
  };

  void (async () => {
    const loaded = await newsActions.loadFromServer();
    if (!loaded) {
      loadFromLocalStorage();
    }
  })();

  window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persistNewsState();
    }
  });

  window.addEventListener('beforeunload', () => {
    persistNewsState();
  });

  setInterval(() => {
    if (document.hidden) {
      return;
    }

    persistNewsState();
  }, 30000);
}
