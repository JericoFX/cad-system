
import { createSignal, createMemo, For, Show, onMount, lazy } from 'solid-js';
import { terminalActions } from '~/stores/terminalStore';
import { 
  newsState, 
  newsActions, 
  NEWS_TEMPLATES, 
  type NewsArticle, 
  type NewsCategory, 
  type NewsPriority, 
  type NewsStatus, 
  type NewsParagraph,
  type NewsTemplate
} from '~/stores/newsStore';
import { photoActions, type PhotoMetadata } from '~/stores/photoStore';

// Lazy load photo components
const NewsPhotoImporter = lazy(() => import('./NewsPhotoImporter').then(m => ({ default: m.NewsPhotoImporter })));
const ReleasedEvidenceFeed = lazy(() => import('./ReleasedEvidenceFeed').then(m => ({ default: m.ReleasedEvidenceFeed })));

export function NewsManager() {
  const [activeTab, setActiveTab] = createSignal<'list' | 'editor' | 'preview' | 'templates' | 'approval' | 'released'>('list');
  const [showPhotoImporter, setShowPhotoImporter] = createSignal(false);
  
  const [, setSelectedTemplate] = createSignal<NewsTemplate | null>(null);
  
  const [form, setForm] = createSignal({
    headline: '',
    subheadline: '',
    category: 'COMMUNITY' as NewsCategory,
    priority: 3 as NewsPriority,
    location: '',
    lead: '',
    conclusion: '',
    tags: [] as string[],
    relatedCaseId: ''
  });
  
  const [paragraphs, setParagraphs] = createSignal<NewsParagraph[]>([]);
  const [gallery, setGallery] = createSignal<{ url: string; caption: string }[]>([]);
  const [featuredImage, setFeaturedImage] = createSignal('');
  const [newTag, setNewTag] = createSignal('');
  const [newParagraph, setNewParagraph] = createSignal('');
  const [newImageUrl, setNewImageUrl] = createSignal('');
  const [newImageCaption, setNewImageCaption] = createSignal('');
  
  onMount(() => {
    newsActions.setCurrentUser({
      id: 'NEWS_001',
      name: 'Reportero LSNN',
      grade: 'EDITOR',
      badge: 'LSNN-001'
    });
  });
  
  const publishedArticles = createMemo(() => 
    Object.values(newsState.articles)
      .filter(a => a.status === 'PUBLISHED' || a.status === 'PENDING_APPROVAL')
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
  );
  
  const draftArticles = createMemo(() =>
    Object.values(newsState.articles)
      .filter(a => a.status === 'DRAFT')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  );

  const pendingApprovals = createMemo(() => newsActions.getPendingApprovals());
  const myPendingSubmissions = createMemo(() => newsActions.getMyPendingSubmissions());

  const newsroomStats = createMemo(() => ({
    published: publishedArticles().filter(a => a.status === 'PUBLISHED').length,
    drafts: draftArticles().length,
    pendingGlobal: pendingApprovals().length,
    pendingMine: myPendingSubmissions().length,
  }));
  
  const canPublish = () => newsActions.can('publish');
  const canEditAll = () => newsActions.can('edit_all');
  const canPin = () => newsActions.can('pin');
  const canDelete = () => newsActions.can('delete_all');

  const normalizeMediaUrl = (raw: string) => {
    const value = raw.trim();
    if (value === '') {
      return '';
    }

    if (value.startsWith('//')) {
      return `https:${value}`;
    }

    if (/^https?:\/\//i.test(value)) {
      return value.replace(/^http:\/\//i, 'https://');
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      return value;
    }

    return `https://${value}`;
  };

  const buildArticleData = (statusOverride?: NewsStatus) => {
    const featuredUrl = normalizeMediaUrl(featuredImage());
    const galleryData = gallery()
      .map((g, i) => {
        const url = normalizeMediaUrl(g.url);
        if (!url) {
          return null;
        }

        return {
          imageId: `IMG_${Date.now()}_${i}`,
          url,
          caption: g.caption,
          order: i + 1,
        };
      })
      .filter((g): g is { imageId: string; url: string; caption: string; order: number } => g !== null);

    return {
      headline: form().headline,
      subheadline: form().subheadline || undefined,
      category: form().category,
      priority: form().priority,
      location: form().location || undefined,
      lead: form().lead,
      paragraphs: paragraphs(),
      conclusion: form().conclusion || undefined,
      tags: form().tags,
      relatedCaseId: form().relatedCaseId || undefined,
      author: newsState.currentUser!,
      featuredImage: featuredUrl
        ? {
            imageId: `IMG_${Date.now()}`,
            url: featuredUrl,
            order: 0,
          }
        : undefined,
      gallery: galleryData,
      status: statusOverride,
    };
  };

  const upsertEditingArticle = (statusOverride?: NewsStatus) => {
    const articleData = buildArticleData(statusOverride);

    if (newsState.editingArticle) {
      const current = newsState.articles[newsState.editingArticle];
      if (current && current.status === 'PUBLISHED' && statusOverride === 'DRAFT') {
        articleData.status = current.status;
      }

      newsActions.updateArticle(newsState.editingArticle, articleData);
      return newsState.editingArticle;
    }

    const article = newsActions.createArticle(articleData);
    newsActions.startEditing(article.articleId);
    return article.articleId;
  };
  
  const getCategoryLabel = (cat: NewsCategory) => {
    const labels: Record<NewsCategory, string> = {
      BREAKING: '🚨 URGENTE',
      POLICE: '👮 POLICÍA',
      EMS: '🚑 EMS',
      COMMUNITY: '🏘️ COMUNIDAD',
      TRAFFIC: '🚦 TRÁFICO',
      WEATHER: '🌤️ CLIMA',
      OFFICIAL: '📢 OFICIAL'
    };
    return labels[cat] || cat;
  };
  
  const getPriorityLabel = (p: NewsPriority) => {
    const labels = ['🚨 CRÍTICO', '🔴 ALTO', '🟡 MEDIO', '🔵 NORMAL', '⚪ BAJO'];
    return labels[p - 1] || 'NORMAL';
  };
  
  const getStatusLabel = (s: NewsStatus) => {
    const labels: Record<NewsStatus, string> = {
      DRAFT: '📝 Borrador',
      PENDING_APPROVAL: '⏳ Pendiente',
      PUBLISHED: '✅ Publicada',
      EXPIRED: '⌛ Expirada',
      ARCHIVED: '🗂️ Archivada'
    };
    return labels[s] || s;
  };
  
  const formatTimeLeft = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const expires = new Date(expiresAt).getTime();
    const now = Date.now();
    const hoursLeft = Math.floor((expires - now) / (1000 * 60 * 60));
    
    if (hoursLeft < 0) return 'Expirada';
    if (hoursLeft < 1) return '< 1h';
    if (hoursLeft === 1) return '1h';
    return `${hoursLeft}h`;
  };
  
  const createNewArticle = () => {
    setSelectedTemplate(null);
    setActiveTab('templates');
  };

  const createFromTemplate = (templateId: NewsTemplate) => {
    const template = NEWS_TEMPLATES[templateId];
    setSelectedTemplate(templateId);
    
    setForm({
      headline: '',
      subheadline: '',
      category: template.defaultCategory,
      priority: template.defaultPriority,
      location: '',
      lead: template.suggestedLead,
      conclusion: '',
      tags: [],
      relatedCaseId: ''
    });
    setParagraphs([]);
    setGallery([]);
    setFeaturedImage('');
    newsActions.startEditing(null);
    setActiveTab('editor');
    
    terminalActions.addLine(`✓ Plantilla "${template.name}" seleccionada`, 'output');
  };
  
  const editArticle = (article: NewsArticle) => {
    setForm({
      headline: article.headline,
      subheadline: article.subheadline || '',
      category: article.category,
      priority: article.priority,
      location: article.location || '',
      lead: article.lead,
      conclusion: article.conclusion || '',
      tags: [...article.tags],
      relatedCaseId: article.relatedCaseId || ''
    });
    setParagraphs([...article.paragraphs]);
    setGallery(article.gallery.map(g => ({ url: g.url, caption: g.caption || '' })));
    setFeaturedImage(article.featuredImage?.url || '');
    newsActions.startEditing(article.articleId);
    setActiveTab('editor');
  };
  
  const addParagraph = () => {
    if (!newParagraph().trim()) return;
    const paragraph: NewsParagraph = {
      paragraphId: `PARA_${Date.now()}`,
      order: paragraphs().length,
      type: 'TEXT',
      content: newParagraph()
    };
    setParagraphs([...paragraphs(), paragraph]);
    setNewParagraph('');
  };
  
  const removeParagraph = (id: string) => {
    setParagraphs(paragraphs().filter(p => p.paragraphId !== id));
  };
  
  const addTag = () => {
    const tag = newTag().trim();
    if (tag && !form().tags.includes(tag)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setNewTag('');
    }
  };
  
  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };
  
  const addImage = () => {
    const url = normalizeMediaUrl(newImageUrl());
    if (url) {
      setGallery([...gallery(), { url, caption: newImageCaption() }]);
      setNewImageUrl('');
      setNewImageCaption('');
    }
  };
  
  const removeImage = (index: number) => {
    setGallery(gallery().filter((_, i) => i !== index));
  };
  
  // Handle imported photos from camera
  const handlePhotosImported = (photos: PhotoMetadata[]) => {
    photos.forEach(photo => {
      setGallery([...gallery(), { 
        url: photo.photoUrl, 
        caption: photo.description || `Photo by ${photo.takenBy} - ${new Date(photo.takenAt).toLocaleDateString()}`
      }]);
    });
    
    const count = photos.length;
    terminalActions.addLine(`✓ ${count} photo${count === 1 ? '' : 's'} imported from camera`, 'output');
    setShowPhotoImporter(false);
  };
  
  const saveDraft = () => {
    upsertEditingArticle('DRAFT');
    
    terminalActions.addLine('✓ Noticia guardada como borrador', 'output');
    setActiveTab('list');
  };
  
  const submitForApproval = () => {
    const articleId = upsertEditingArticle('DRAFT');
    newsActions.submitForApproval(articleId);
    terminalActions.addLine('✓ Noticia enviada a aprobación', 'output');
    setActiveTab('list');
  };
  
  const publishArticle = () => {
    const articleId = upsertEditingArticle();
    newsActions.publishArticle(articleId);
    
    terminalActions.addLine('✓ Noticia publicada exitosamente', 'output');
    setActiveTab('list');
  };
  
  const viewArticle = (article: NewsArticle) => {
    newsActions.selectArticle(article.articleId);
    newsActions.incrementViews(article.articleId);
    setActiveTab('preview');
  };
  
  const copyShareCode = (code: string) => {
    navigator.clipboard.writeText(code);
    terminalActions.addLine(`✓ Código copiado: ${code}`, 'output');
  };
  
  const closeModal = () => {
    terminalActions.setActiveModal(null);
  };
  
  return (
    <div class="modal-overlay" onClick={closeModal}>
      <div class="modal-content news-manager" onClick={e => e.stopPropagation()}>
        <div class="modal-header">
          <h2>📰 CENTRAL DE NOTICIAS - Los Santos News Network</h2>
          <button class="close-btn" onClick={closeModal}>×</button>
        </div>
        
        <div class="detail-tabs">
          <button 
            class={`tab ${activeTab() === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            📰 Noticias
          </button>
          <button 
            class={`tab ${activeTab() === 'templates' ? 'active' : ''}`}
            onClick={() => setActiveTab('templates')}
          >
            📋 Plantillas
          </button>
          <button 
            class={`tab ${activeTab() === 'approval' ? 'active' : ''}`}
            onClick={() => setActiveTab('approval')}
          >
            ⏳ Aprobaciones
          </button>
          <button 
            class={`tab ${activeTab() === 'released' ? 'active' : ''}`}
            onClick={() => setActiveTab('released')}
            style={{ color: '#ffff00' }}
          >
            📸 Evidencia Liberada
          </button>
          <button 
            class={`tab ${activeTab() === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            ✏️ Editor
          </button>
          <button 
            class={`tab ${activeTab() === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
            disabled={!newsState.selectedArticle}
          >
            👁️ Vista Previa
          </button>
        </div>

        <div class="news-workspace-bar">
          <div class="workspace-role">
            Sala: <strong>{newsState.currentUser?.grade || 'REPORTER'}</strong>
            <span class="workspace-user">{newsState.currentUser?.name || 'Sin usuario'}</span>
          </div>
          <div class="workspace-stats">
            <span>[PUBLISHED: {newsroomStats().published}]</span>
            <span>[DRAFTS: {newsroomStats().drafts}]</span>
            <span>[PENDING: {newsroomStats().pendingGlobal}]</span>
            <span>[MY QUEUE: {newsroomStats().pendingMine}]</span>
          </div>
        </div>
        
        <div class="modal-body">
          <Show when={activeTab() === 'list'}>
            <div class="news-list">
              <div class="section-header">
                <h3>📰 Noticias Publicadas</h3>
                <button class="btn btn-primary" onClick={createNewArticle}>
                  ➕ Nueva Noticia
                </button>
              </div>
              
              <div class="articles-grid">
                <For each={publishedArticles()}>
                  {(article) => (
                    <div class={`article-card ${article.isPinned ? 'pinned' : ''}`}>
                      <div class="article-header">
                        <span class={`category-badge category-${article.category.toLowerCase()}`}>
                          {getCategoryLabel(article.category)}
                        </span>
                        <span class="priority-badge">
                          {getPriorityLabel(article.priority)}
                        </span>
                        {article.isPinned && <span class="pin-badge">📌</span>}
                      </div>
                      
                      <h4 class="article-title">{article.headline}</h4>
                      <p class="article-subtitle">{article.subheadline}</p>

                      <Show when={article.featuredImage?.url}>
                        <div class="article-thumb">
                          <img src={normalizeMediaUrl(article.featuredImage!.url)} alt={article.headline} />
                        </div>
                      </Show>
                      
                      <div class="article-meta">
                        <span>Por: {article.author.name}</span>
                        <span>👁 {article.viewCount}</span>
                        <Show when={article.expiresAt}>
                          <span class="time-left">⏱ {formatTimeLeft(article.expiresAt)}</span>
                        </Show>
                      </div>
                      
                      <div class="article-actions">
                        <button class="btn btn-small" onClick={() => viewArticle(article)}>
                          👁 Ver
                        </button>
                        
                        {(canEditAll() || article.author.id === newsState.currentUser?.id) && (
                          <button class="btn btn-small" onClick={() => editArticle(article)}>
                            ✏️ Editar
                          </button>
                        )}
                        
                        <button 
                          class="btn btn-small btn-secondary" 
                          onClick={() => copyShareCode(article.shareCode)}
                        >
                          📋 {article.shareCode}
                        </button>
                        
                        {canPin() && (
                          <button 
                            class="btn btn-small"
                            onClick={() => newsActions.togglePin(article.articleId)}
                          >
                            {article.isPinned ? '📌 Quitar' : '📌 Anclar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </For>
              </div>
              
              <Show when={draftArticles().length > 0}>
                <div class="section-header" style={{ 'margin-top': '2rem' }}>
                  <h3>📝 Borradores</h3>
                </div>
                <div class="articles-grid">
                  <For each={draftArticles()}>
                    {(article) => (
                      <div class="article-card draft">
                        <div class="article-header">
                          <span class="status-badge">{getStatusLabel(article.status)}</span>
                        </div>
                        <h4 class="article-title">{article.headline || 'Sin título'}</h4>
                        <div class="article-meta">
                          <span>Editado: {new Date(article.updatedAt).toLocaleDateString()}</span>
                        </div>
                        <div class="article-actions">
                          <button class="btn btn-small" onClick={() => editArticle(article)}>
                            ✏️ Continuar
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
          
          <Show when={activeTab() === 'templates'}>
            <div class="news-templates">
              <div class="section-header">
                <h3>📋 Seleccionar Plantilla</h3>
                <p class="section-description">Elige una plantilla para crear tu noticia más rápido</p>
              </div>
              
              <div class="templates-grid">
                <For each={Object.values(NEWS_TEMPLATES)}>
                  {(template) => (
                    <button 
                      class="template-card"
                      onClick={() => createFromTemplate(template.id)}
                    >
                      <span class="template-icon">{template.icon}</span>
                      <h4>{template.name}</h4>
                      <p class="template-desc">Prioridad: {template.defaultPriority} | Expira: {template.autoExpireHours}h</p>
                      <span class="template-category">{template.defaultCategory}</span>
                    </button>
                  )}
                </For>
              </div>
              
              <div class="templates-info">
                <h4>💡 Consejos de uso:</h4>
                <ul>
                  <li><strong>Breaking News:</strong> Para emergencias en tiempo real. Expira rápido.</li>
                  <li><strong>Comunicado Oficial:</strong> Anuncios formales del departamento.</li>
                  <li><strong>Cobertura en Vivo:</strong> Seguimiento continuo de eventos.</li>
                  <li><strong>Cierre de Incidente:</strong> Cuando una situación se resuelve.</li>
                </ul>
              </div>
            </div>
          </Show>
          
          <Show when={activeTab() === 'approval'}>
            <div class="news-approval">
              <div class="section-header">
                <h3>⏳ Cola de Aprobación</h3>
              </div>
              
              <Show when={newsActions.getMyPendingSubmissions().length > 0}>
                <h4 class="subsection-title">Mis Envíos Pendientes</h4>
                <div class="articles-grid">
                  <For each={newsActions.getMyPendingSubmissions()}>
                    {(article) => (
                      <div class="article-card pending">
                        <div class="article-header">
                          <span class="status-badge">⏳ Pendiente</span>
                        </div>
                        <h4>{article.headline}</h4>
                        <p>Enviado: {new Date(article.updatedAt).toLocaleDateString()}</p>
                        <button class="btn btn-small" onClick={() => editArticle(article)}>
                          Ver/Editar
                        </button>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
              
              <Show when={newsActions.can('approve')}>
                <h4 class="subsection-title">Pendientes de Aprobación</h4>
                <Show when={newsActions.getPendingApprovals().length === 0}>
                  <div class="empty-state">No hay noticias pendientes de aprobación</div>
                </Show>
                <div class="articles-grid">
                  <For each={newsActions.getPendingApprovals()}>
                    {(article) => (
                      <div class="article-card awaiting">
                        <div class="article-header">
                          <span class={`priority-badge priority-${article.priority}`}>
                            Prioridad {article.priority}
                          </span>
                        </div>
                        <h4>{article.headline}</h4>
                        <p>Por: {article.author.name}</p>
                        <div class="approval-actions">
                          <button 
                            class="btn btn-small btn-success" 
                            onClick={() => {
                              newsActions.approveArticle(article.articleId, newsState.currentUser?.id || 'SYSTEM');
                              terminalActions.addLine(`✓ Noticia aprobada: ${article.headline}`, 'system');
                            }}
                          >
                            ✅ Aprobar
                          </button>
                          <button 
                            class="btn btn-small btn-danger" 
                            onClick={() => {
                              newsActions.rejectArticle(article.articleId, 'Rechazado por editor');
                              terminalActions.addLine(`✗ Noticia rechazada: ${article.headline}`, 'error');
                            }}
                          >
                            ❌ Rechazar
                          </button>
                          <button class="btn btn-small" onClick={() => editArticle(article)}>
                            Revisar
                          </button>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </Show>
            </div>
          </Show>
          
          <Show when={activeTab() === 'released'}>
            <ReleasedEvidenceFeed 
              onPhotoSelect={(photo) => {
                // Add selected photo to gallery
                setGallery([...gallery(), { 
                  url: photo.photoUrl, 
                  caption: photo.description || `Released evidence - ${photo.photoId}`
                }]);
                terminalActions.addLine(`Photo ${photo.photoId} added to article`, 'output');
              }}
            />
          </Show>
          
          <Show when={activeTab() === 'editor'}>
            <div class="news-editor">
              <div class="editor-section">
                <h3>📝 Cabecera</h3>
                
                <div class="form-group">
                  <label>Título de la Noticia</label>
                  <input
                    type="text"
                    value={form().headline}
                    onInput={(e) => setForm(prev => ({ ...prev, headline: e.currentTarget.value }))}
                    placeholder="Ej: La policía desmantela red de narcotráfico"
                    maxlength={100}
                  />
                </div>
                
                <div class="form-group">
                  <label>Subtítulo</label>
                  <input
                    type="text"
                    value={form().subheadline}
                    onInput={(e) => setForm(prev => ({ ...prev, subheadline: e.currentTarget.value }))}
                    placeholder="Bajada o subtítulo descriptivo"
                    maxlength={150}
                  />
                </div>
                
                <div class="form-row">
                  <div class="form-group">
                    <label>Categoría</label>
                    <select
                      value={form().category}
                      onChange={(e) => setForm(prev => ({ ...prev, category: e.currentTarget.value as NewsCategory }))}
                    >
                      <option value="BREAKING">🚨 Urgente</option>
                      <option value="POLICE">👮 Policía</option>
                      <option value="EMS">🚑 EMS</option>
                      <option value="COMMUNITY">🏘️ Comunidad</option>
                      <option value="TRAFFIC">🚦 Tráfico</option>
                      <option value="WEATHER">🌤️ Clima</option>
                      <option value="OFFICIAL">📢 Oficial</option>
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label>Prioridad</label>
                    <select
                      value={form().priority}
                      onChange={(e) => setForm(prev => ({ ...prev, priority: parseInt(e.currentTarget.value) as NewsPriority }))}
                    >
                      <option value={1}>🚨 Crítico</option>
                      <option value={2}>🔴 Alto</option>
                      <option value={3}>🟡 Medio</option>
                      <option value={4}>🔵 Normal</option>
                      <option value={5}>⚪ Bajo</option>
                    </select>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>Ubicación</label>
                  <input
                    type="text"
                    value={form().location}
                    onInput={(e) => setForm(prev => ({ ...prev, location: e.currentTarget.value }))}
                    placeholder="Ej: Downtown, Los Santos"
                  />
                </div>
              </div>
              
              <div class="editor-section">
                <h3>📄 Contenido</h3>
                
                <div class="form-group">
                  <label>Entradilla (Lead)</label>
                  <textarea
                    value={form().lead}
                    onInput={(e) => setForm(prev => ({ ...prev, lead: e.currentTarget.value }))}
                    placeholder="Párrafo introductorio que resume la noticia (máx 300 caracteres)"
                    rows={3}
                    maxlength={300}
                  />
                  <small>{form().lead.length}/300 caracteres</small>
                </div>
                
                <div class="form-group">
                  <label>Cuerpo de la Noticia</label>
                  <div class="paragraphs-list">
                    <For each={paragraphs()}>
                      {(para, index) => (
                        <div class="paragraph-item">
                          <span class="para-number">{index() + 1}</span>
                          <p>{para.content}</p>
                          <button 
                            class="btn btn-small btn-danger"
                            onClick={() => removeParagraph(para.paragraphId)}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                  
                  <div class="add-paragraph">
                    <textarea
                      value={newParagraph()}
                      onInput={(e) => setNewParagraph(e.currentTarget.value)}
                      placeholder="Escribir nuevo párrafo..."
                      rows={2}
                    />
                    <button class="btn btn-secondary" onClick={addParagraph}>
                      ➕ Añadir Párrafo
                    </button>
                  </div>
                </div>
                
                <div class="form-group">
                  <label>Conclusión (opcional)</label>
                  <textarea
                    value={form().conclusion}
                    onInput={(e) => setForm(prev => ({ ...prev, conclusion: e.currentTarget.value }))}
                    placeholder="Párrafo final o cierre de la noticia"
                    rows={2}
                  />
                </div>
              </div>
              
              <div class="editor-section">
                <h3>🖼️ Multimedia</h3>
                
                <div class="form-group">
                  <label>Imagen Principal (URL)</label>
                  <input
                    type="text"
                    value={featuredImage()}
                    onInput={(e) => setFeaturedImage(e.currentTarget.value)}
                    placeholder="https://i.imgur.com/..."
                  />
                  <Show when={normalizeMediaUrl(featuredImage())}>
                    <div class="image-preview">
                      <img src={normalizeMediaUrl(featuredImage())} alt="Preview" />
                    </div>
                  </Show>
                </div>
                
                <div class="form-group">
                  <label>Galería de Imágenes</label>
                  <div class="gallery-list">
                    <For each={gallery()}>
                      {(img, index) => (
                        <div class="gallery-item">
                          <img src={normalizeMediaUrl(img.url)} alt={img.caption} />
                          <span>{img.caption}</span>
                          <button 
                            class="btn btn-small btn-danger"
                            onClick={() => removeImage(index())}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </For>
                  </div>
                  
                  <div class="add-image">
                    <input
                      type="text"
                      value={newImageUrl()}
                      onInput={(e) => setNewImageUrl(e.currentTarget.value)}
                      placeholder="URL de la imagen"
                    />
                    <input
                      type="text"
                      value={newImageCaption()}
                      onInput={(e) => setNewImageCaption(e.currentTarget.value)}
                      placeholder="Pie de foto (opcional)"
                    />
                    <button class="btn btn-secondary" onClick={addImage}>
                      ➕ Añadir Imagen
                    </button>
                  </div>
                  
                  <div style={{ 'margin-top': '10px', 'border-top': '1px solid var(--terminal-border-dim)', 'padding-top': '10px' }}>
                    <button 
                      class="btn btn-primary"
                      onClick={() => setShowPhotoImporter(true)}
                      style={{ 'background-color': '#00ffff', color: '#000', width: '100%' }}
                    >
                      📷 Importar Fotos de Cámara
                    </button>
                  </div>
                </div>
              </div>
              
              <div class="editor-section">
                <h3>🏷️ Etiquetas</h3>
                
                <div class="tags-list">
                  <For each={form().tags}>
                    {(tag) => (
                      <span class="tag">
                        #{tag}
                        <button onClick={() => removeTag(tag)}>×</button>
                      </span>
                    )}
                  </For>
                </div>
                
                <div class="add-tag">
                  <input
                    type="text"
                    value={newTag()}
                    onInput={(e) => setNewTag(e.currentTarget.value)}
                    placeholder="Nueva etiqueta"
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <button class="btn btn-secondary" onClick={addTag}>
                    ➕ Añadir
                  </button>
                </div>
              </div>
              
              <div class="editor-actions">
                <button class="btn btn-secondary" onClick={() => setActiveTab('list')}>
                  Cancelar
                </button>
                <button class="btn btn-primary" onClick={saveDraft}>
                  💾 Guardar Borrador
                </button>
                
                <Show when={!canPublish()}>
                  <button class="btn btn-warning" onClick={submitForApproval}>
                    📤 Enviar a Aprobación
                  </button>
                </Show>
                
                <Show when={canPublish()}>
                  <button class="btn btn-success" onClick={publishArticle}>
                    📢 Publicar Noticia
                  </button>
                </Show>
              </div>
            </div>
          </Show>
          
          <Show when={activeTab() === 'preview' && newsState.selectedArticle}>
            <div class="news-preview">
              {(() => {
                const article = newsState.articles[newsState.selectedArticle!];
                if (!article) return null;
                
                return (
                  <div class="article-full">
                    <div class="article-header-full">
                      <div class="article-badges">
                        <span class={`category-badge category-${article.category.toLowerCase()}`}>
                          {getCategoryLabel(article.category)}
                        </span>
                        <span class="priority-badge">
                          {getPriorityLabel(article.priority)}
                        </span>
                      </div>
                      
                      <h1>{article.headline}</h1>
                      <Show when={article.subheadline}>
                        <h2>{article.subheadline}</h2>
                      </Show>
                      
                      <div class="article-meta-full">
                        <span>Por: {article.author.name} ({article.author.grade})</span>
                        <span>Publicado: {new Date(article.publishedAt || article.createdAt).toLocaleString()}</span>
                        <span>👁 {article.viewCount} vistas</span>
                        <Show when={article.location}>
                          <span>📍 {article.location}</span>
                        </Show>
                      </div>
                    </div>
                    
                    <Show when={article.featuredImage}>
                      <div class="featured-image">
                        <img src={normalizeMediaUrl(article.featuredImage!.url)} alt={article.headline} />
                      </div>
                    </Show>
                    
                    <div class="article-content-full">
                      <p class="lead">{article.lead}</p>
                      
                      <For each={article.paragraphs.sort((a, b) => a.order - b.order)}>
                        {(para) => (
                          <p>{para.content}</p>
                        )}
                      </For>
                      
                      <Show when={article.conclusion}>
                        <p class="conclusion">{article.conclusion}</p>
                      </Show>
                    </div>
                    
                    <Show when={article.gallery.length > 0}>
                      <div class="article-gallery">
                        <h4>Galería de Imágenes</h4>
                        <div class="gallery-grid">
                          <For each={article.gallery}>
                            {(img) => (
                              <div class="gallery-item-full">
                                <img src={normalizeMediaUrl(img.url)} alt={img.caption} />
                                <Show when={img.caption}>
                                  <span>{img.caption}</span>
                                </Show>
                              </div>
                            )}
                          </For>
                        </div>
                      </div>
                    </Show>
                    
                    <Show when={article.tags.length > 0}>
                      <div class="article-tags">
                        <For each={article.tags}>
                          {(tag) => (
                            <span class="tag">#{tag}</span>
                          )}
                        </For>
                      </div>
                    </Show>
                    
                    <div class="article-footer">
                      <div class="share-section">
                        <strong>Compartir:</strong>
                        <span class="share-code">Código: {article.shareCode}</span>
                        <button 
                          class="btn btn-small"
                          onClick={() => copyShareCode(article.shareCode)}
                        >
                          📋 Copiar
                        </button>
                      </div>
                      
                      <Show when={canDelete() || article.author.id === newsState.currentUser?.id}>
                        <button 
                          class="btn btn-danger"
                          onClick={() => {
                            if (confirm('¿Eliminar esta noticia?')) {
                              newsActions.deleteArticle(article.articleId);
                              setActiveTab('list');
                            }
                          }}
                        >
                          🗑️ Eliminar Noticia
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              })()}
            </div>
          </Show>
        </div>
      </div>
      
      {/* Photo Importer Modal */}
      <Show when={showPhotoImporter()}>
        <NewsPhotoImporter
          onPhotosSelected={handlePhotosImported}
          onCancel={() => setShowPhotoImporter(false)}
          maxPhotos={10}
        />
      </Show>
    </div>
  );
}
