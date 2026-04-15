import { useState, useRef } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { useContent } from '../context/ContentContext';
import { visibleName } from '../data';
import Av from './Av';
import SLCharPicker from './SLCharPicker';

export default function ComposeScreen({ onClose }) {
  const { currentUser, posts, setPosts, toast } = useApp();
  const { interestGroups } = useContent();
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [selTags, setSelTags] = useState([]);
  const [selGroup, setSelGroup] = useState(null);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);

  const toggleTag = tag => setSelTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  );

  const handleImage = e => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handlePost = async () => {
    if (!caption.trim() && !image) {
      toast('Add a caption or photo first', 'error');
      return;
    }
    setPosting(true);
    try {
      const newPost = {
        id: Date.now(),
        userId: currentUser.id,
        image: imagePreview || null,
        caption: caption.trim(),
        tags: selTags,
        likes: 0,
        comments: [],
        time: 'just now',
        locationId: null,
      };
      setPosts(prev => [newPost, ...prev]);
      toast('Posted! ✓');
      onClose();
    } catch (e) {
      toast('Failed to post', 'error');
    } finally {
      setPosting(false);
    }
  };

  const selectedGroupData = interestGroups.find(g => g.id === selGroup);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }} className="fadeUp">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22 }}>✕</button>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text, flex: 1 }}>New Post</span>
        <button
          onClick={handlePost}
          disabled={posting || (!caption.trim() && !image)}
          style={{ padding: '8px 20px', borderRadius: 20, background: (!caption.trim() && !image) ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: (!caption.trim() && !image) ? C.muted : '#060d14', fontWeight: 900, fontSize: 13, transition: 'all .2s' }}>
          {posting ? '⏳' : 'Post'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* User + caption */}
        <div style={{ display: 'flex', gap: 12, padding: '16px 16px 0', alignItems: 'flex-start' }}>
          <Av src={currentUser.avatar} size={40} ring={C.sky} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6 }}>{visibleName(currentUser)}</div>
            <div style={{ position: 'relative' }}>
              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="What's happening on the grid?"
                style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 15, lineHeight: 1.6, resize: 'none', minHeight: 100, outline: 'none', fontFamily: 'inherit', paddingRight: 32 }}
                autoFocus
              />
              <button
                onClick={() => setShowCharPicker(!showCharPicker)}
                style={{ position: 'absolute', right: 0, top: 0, fontSize: 16, color: showCharPicker ? C.sky : C.muted }}>
                ★
              </button>
            </div>
            {showCharPicker && (
              <div style={{ marginTop: 6 }}>
                <SLCharPicker onInsert={c => setCaption(p => p + c)} onClose={() => setShowCharPicker(false)} />
              </div>
            )}
          </div>
        </div>

        {/* Image preview */}
        {imagePreview && (
          <div style={{ position: 'relative', margin: '12px 16px 0' }}>
            <img src={imagePreview} alt="" style={{ width: '100%', borderRadius: 14, maxHeight: 300, objectFit: 'cover' }} />
            <button
              onClick={() => { setImage(null); setImagePreview(null); }}
              style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
          </div>
        )}

        {/* Tags section */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 10 }}>ADD TAGS</div>

          {/* Group selector */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 8, paddingBottom: 2 }}>
            {interestGroups.map(g => (
              <button key={g.id} onClick={() => setSelGroup(selGroup === g.id ? null : g.id)}
                style={{ flexShrink: 0, fontSize: 11, padding: '5px 12px', borderRadius: 20, fontWeight: 700,
                  border: `1.5px solid ${selGroup === g.id ? g.color : C.border}`,
                  background: selGroup === g.id ? `${g.color}22` : 'transparent',
                  color: selGroup === g.id ? g.color : C.muted,
                  whiteSpace: 'nowrap' }}>
                {g.icon} {g.label}
              </button>
            ))}
          </div>

          {/* Tags for selected group */}
          {selectedGroupData && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', background: C.card2, borderRadius: 12, marginBottom: 8 }}>
              {(selectedGroupData.tags || []).map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700,
                    border: `1px solid ${selTags.includes(tag) ? selectedGroupData.color : C.border}`,
                    background: selTags.includes(tag) ? `${selectedGroupData.color}22` : 'transparent',
                    color: selTags.includes(tag) ? selectedGroupData.color : C.muted }}>
                  {tag}
                </button>
              ))}
            </div>
          )}

          {/* Selected tags */}
          {selTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {selTags.map(tag => {
                const grp = interestGroups.find(g => g.tags?.includes(tag));
                return (
                  <button key={tag} onClick={() => toggleTag(tag)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, fontWeight: 700,
                      background: `${grp?.color || C.sky}22`, color: grp?.color || C.sky,
                      border: `1px solid ${grp?.color || C.sky}44` }}>
                    {tag} ✕
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, background: C.card, display: 'flex', gap: 16, alignItems: 'center', flexShrink: 0 }}>
        <button onClick={() => fileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.sky, fontSize: 13, fontWeight: 700 }}>
          <span style={{ fontSize: 20 }}>📷</span> Photo
        </button>
        <div style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>
          {caption.length > 0 && `${caption.length} chars`}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
    </div>
  );
}
