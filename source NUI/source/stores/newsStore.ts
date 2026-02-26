
import { createStore } from 'solid-js/store';
import { fetchNui } from '~/utils/fetchNui';

export type NewsGrade = 'REPORTER' | 'EDITOR' | 'CHIEF_EDITOR' | 'DIRECTOR';
export type NewsCategory = 'BREAKING' | 'POLICE' | 'EMS' | 'COMMUNITY' | 'TRAFFIC' | 'WEATHER' | 'OFFICIAL';
export type NewsPriority = 1 | 2 | 3 | 4 | 5; // 1 = Urgente, 5 = Informativo
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

export type NewsTemplate = 'BREAKING' | 'STATEMENT' | 'COVERAGE' | 'CLOSURE' | 'CUSTOM';

export interface NewsTemplateConfig {
  id: NewsTemplate;
  name: string;
  icon: string;
  defaultPriority: NewsPriority;
  defaultCategory: NewsCategory;
  suggestedLead: string;
  autoExpireHours: number;
}

export const NEWS_TEMPLATES: Record<NewsTemplate, NewsTemplateConfig> = {
  BREAKING: {
    id: 'BREAKING',
    name: '🚨 Breaking News',
    icon: '🚨',
    defaultPriority: 1,
    defaultCategory: 'BREAKING',
    suggestedLead: 'URGENT: [Evento] en [Ubicación]. Autoridades en camino.',
    autoExpireHours: 2
  },
  STATEMENT: {
    id: 'STATEMENT',
    name: '📢 Comunicado Oficial',
    icon: '📢',
    defaultPriority: 2,
    defaultCategory: 'OFFICIAL',
    suggestedLead: 'El [Departamento] informa sobre [Asunto].',
    autoExpireHours: 48
  },
  COVERAGE: {
    id: 'COVERAGE',
    name: '📰 Cobertura en Vivo',
    icon: '📰',
    defaultPriority: 3,
    defaultCategory: 'COMMUNITY',
    suggestedLead: 'Seguimiento en tiempo real de [Evento].',
    autoExpireHours: 12
  },
  CLOSURE: {
    id: 'CLOSURE',
    name: '✅ Cierre de Incidente',
    icon: '✅',
    defaultPriority: 4,
    defaultCategory: 'POLICE',
    suggestedLead: 'Resolución del incidente [Caso]. Situación normalizada.',
    autoExpireHours: 24
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: '📝 Nota Libre',
    icon: '📝',
    defaultPriority: 3,
    defaultCategory: 'COMMUNITY',
    suggestedLead: '',
    autoExpireHours: 24
  }
};

export type AssignmentStatus = 'PENDING' | 'ASSIGNED' | 'IN_FIELD' | 'WRITING' | 'REVIEW' | 'PUBLISHED';

export interface NewsAssignment {
  assignmentId: string;
  articleId: string;
  reporterId: string;
  reporterName: string;
  assignedBy: string;
  assignedAt: string;
  status: AssignmentStatus;
  notes?: string;
  location?: string;
  priority: NewsPriority;
  deadline?: string;
}

export interface PublishingChecklist {
  hasHeadline: boolean;
  hasLead: boolean;
  hasCategory: boolean;
  hasPriority: boolean;
  hasMinimumContent: boolean; // At least 1 paragraph
  hasSource: boolean;
  hasLocation: boolean;
  mediaApproved: boolean;
  legalReviewed: boolean;
  allChecked: boolean;
}

export interface NewsState {
  articles: Record<string, NewsArticle>;
  assignments: Record<string, NewsAssignment>;
  currentUser: {
    id: string;
    name: string;
    grade: NewsGrade;
    badge?: string;
  } | null;
  filters: {
    category: NewsCategory | null;
    status: NewsStatus | null;
    author: string | null;
    searchQuery: string;
  };
  selectedArticle: string | null;
  editingArticle: string | null;
  activeTemplate: NewsTemplate | null;
}

const initialState: NewsState = {
  articles: {},
  assignments: {},
  currentUser: null,
  filters: {
    category: null,
    status: null,
    author: null,
    searchQuery: ''
  },
  selectedArticle: null,
  editingArticle: null,
  activeTemplate: null
};

export const [newsState, setNewsState] = createStore<NewsState>(initialState);

const PERMISSIONS: Record<NewsGrade, string[]> = {
  REPORTER: ['create', 'edit_own', 'send_for_approval'],
  EDITOR: ['create', 'edit_own', 'edit_all', 'publish', 'publish_urgent', 'approve'],
  CHIEF_EDITOR: ['create', 'edit_own', 'edit_all', 'publish', 'publish_urgent', 'approve', 'pin', 'delete_all'],
  DIRECTOR: ['create', 'edit_own', 'edit_all', 'publish', 'publish_urgent', 'approve', 'pin', 'delete_all', 'admin']
};

function hasPermission(grade: NewsGrade, permission: string): boolean {
  return PERMISSIONS[grade]?.includes(permission) || false;
}

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

function cloneImage(image?: NewsImage): NewsImage | undefined {
  if (!image) {
    return undefined;
  }

  return {
    imageId: image.imageId,
    url: image.url,
    caption: image.caption,
    order: image.order,
  };
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
  
  createArticle(articleData: Partial<NewsArticle>): NewsArticle {
    const articleId = generateId();
    const now = new Date().toISOString();
    
    const article: NewsArticle = {
      articleId,
      headline: articleData.headline || 'Sin título',
      subheadline: articleData.subheadline,
      category: articleData.category || 'COMMUNITY',
      priority: articleData.priority || 3,
      location: articleData.location,
      author: articleData.author || {
        id: 'UNKNOWN',
        name: 'Desconocido',
        grade: 'REPORTER'
      },
      createdAt: now,
      updatedAt: now,
      lead: articleData.lead || '',
      paragraphs: articleData.paragraphs || [],
      conclusion: articleData.conclusion,
      featuredImage: cloneImage(articleData.featuredImage),
      gallery: articleData.gallery || [],
      attachments: articleData.attachments || [],
      tags: articleData.tags || [],
      relatedCaseId: articleData.relatedCaseId,
      status: articleData.status || 'DRAFT',
      isPinned: false,
      viewCount: 0,
      shareCode: generateShareCode()
    };
    
    setNewsState('articles', articleId, article);
    this.emitNewsEvent('updated', articleId);
    return article;
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
  
  submitForApproval(articleId: string) {
    this.updateArticle(articleId, { status: 'PENDING_APPROVAL' });
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
  
  can(permission: string): boolean {
    const user = newsState.currentUser;
    if (!user) return false;
    return hasPermission(user.grade, permission);
  },

  setActiveTemplate(template: NewsTemplate | null) {
    setNewsState('activeTemplate', template);
  },

  createArticleFromTemplate(templateId: NewsTemplate, customData?: Partial<NewsArticle>): NewsArticle {
    const template = NEWS_TEMPLATES[templateId];
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + template.autoExpireHours);

    const articleData: Partial<NewsArticle> = {
      headline: customData?.headline || `[${template.name}] Sin título`,
      subheadline: customData?.subheadline,
      category: template.defaultCategory,
      priority: template.defaultPriority,
      lead: customData?.lead || template.suggestedLead,
      paragraphs: customData?.paragraphs || [],
      author: customData?.author || newsState.currentUser || {
        id: 'UNKNOWN',
        name: 'Desconocido',
        grade: 'REPORTER'
      },
      status: 'DRAFT',
      expiresAt: expiresAt.toISOString()
    };

    const article = this.createArticle(articleData);
    this.setActiveTemplate(templateId);
    return article;
  },

  validatePublishingChecklist(articleId: string): PublishingChecklist {
    const article = newsState.articles[articleId];
    if (!article) {
      return {
        hasHeadline: false,
        hasLead: false,
        hasCategory: false,
        hasPriority: false,
        hasMinimumContent: false,
        hasSource: false,
        hasLocation: false,
        mediaApproved: false,
        legalReviewed: false,
        allChecked: false
      };
    }

    const checklist: PublishingChecklist = {
      hasHeadline: article.headline.length > 0 && article.headline !== 'Sin título',
      hasLead: article.lead.length > 0,
      hasCategory: !!article.category,
      hasPriority: !!article.priority,
      hasMinimumContent: article.paragraphs.length > 0,
      hasSource: true, // TODO: Add source field to article
      hasLocation: !!article.location,
      mediaApproved: true, // TODO: Add media approval workflow
      legalReviewed: true, // TODO: Add legal review workflow
      allChecked: false
    };

    checklist.allChecked = 
      checklist.hasHeadline &&
      checklist.hasLead &&
      checklist.hasCategory &&
      checklist.hasPriority &&
      checklist.hasMinimumContent;

    return checklist;
  },

  canPublish(articleId: string): { allowed: boolean; reason?: string } {
    const article = newsState.articles[articleId];
    if (!article) return { allowed: false, reason: 'Article not found' };

    const checklist = this.validatePublishingChecklist(articleId);
    if (!checklist.allChecked) {
      const missing = [];
      if (!checklist.hasHeadline) missing.push('título');
      if (!checklist.hasLead) missing.push('entradilla');
      if (!checklist.hasCategory) missing.push('categoría');
      if (!checklist.hasPriority) missing.push('prioridad');
      if (!checklist.hasMinimumContent) missing.push('contenido mínimo');
      return { allowed: false, reason: `Faltan: ${missing.join(', ')}` };
    }

    const user = newsState.currentUser;
    if (!user) return { allowed: false, reason: 'No user logged in' };

    if (article.priority <= 2 && !hasPermission(user.grade, 'publish_urgent')) {
      return { allowed: false, reason: 'Requires EDITOR or higher for urgent news' };
    }

    if (!hasPermission(user.grade, 'publish')) {
      return { allowed: false, reason: 'No publish permission' };
    }

    return { allowed: true };
  },

  createAssignment(articleId: string, reporterId: string, reporterName: string, notes?: string, deadline?: string): NewsAssignment {
    const assignmentId = `ASSIGN_${Date.now()}`;
    const assignment: NewsAssignment = {
      assignmentId,
      articleId,
      reporterId,
      reporterName,
      assignedBy: newsState.currentUser?.id || 'SYSTEM',
      assignedAt: new Date().toISOString(),
      status: 'ASSIGNED',
      notes,
      deadline,
      priority: newsState.articles[articleId]?.priority || 3
    };

    setNewsState('assignments', assignmentId, assignment);
    return assignment;
  },

  updateAssignmentStatus(assignmentId: string, status: AssignmentStatus) {
    setNewsState('assignments', assignmentId, 'status', status);
  },

  getAssignmentsForArticle(articleId: string): NewsAssignment[] {
    return Object.values(newsState.assignments).filter(a => a.articleId === articleId);
  },

  getMyAssignments(): NewsAssignment[] {
    const userId = newsState.currentUser?.id;
    if (!userId) return [];
    return Object.values(newsState.assignments).filter(a => a.reporterId === userId);
  },

  getPendingApprovals(): NewsArticle[] {
    return Object.values(newsState.articles)
      .filter(a => a.status === 'PENDING_APPROVAL')
      .sort((a, b) => a.priority - b.priority);
  },

  getMyPendingSubmissions(): NewsArticle[] {
    const userId = newsState.currentUser?.id;
    if (!userId) return [];
    return Object.values(newsState.articles)
      .filter(a => a.status === 'PENDING_APPROVAL' && a.author.id === userId);
  },

  approveArticle(articleId: string, approverId: string) {
    const article = newsState.articles[articleId];
    if (!article) return;

    if (article.status !== 'PENDING_APPROVAL') {
      console.warn('[News] Article not in pending approval state');
      return;
    }

    console.log(`[News] Article ${articleId} approved by ${approverId}`);

    this.publishArticle(articleId);
    
    const assignments = this.getAssignmentsForArticle(articleId);
    assignments.forEach(a => {
      if (a.status !== 'PUBLISHED') {
        this.updateAssignmentStatus(a.assignmentId, 'PUBLISHED');
      }
    });
  },

  rejectArticle(articleId: string, reason: string) {
    this.updateArticle(articleId, { 
      status: 'DRAFT',
    });
    
    console.log(`[News] Article ${articleId} rejected: ${reason}`);
  }
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
