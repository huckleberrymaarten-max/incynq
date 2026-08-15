import { useState, useRef } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { useContent } from '../context/ContentContext';
import { visibleName } from '../data';
import { createPost, uploadPostImage } from '../lib/db';
import { supabase } from '../lib/supabase';
import Av from './Av';
import ImageCropModal from './ImageCropModal';

export default function ComposeScreen({ onClose }) {
  const { currentUser, posts, setPosts, toast } = useApp();

  const activeBrandId = currentUser.brandMode
    ? (currentUser.managingBrandId || (
        (currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand')
          ? currentUser.id : null
      ))
    : null;
  // Post-as-DJ: when in performer mode, attribute the post to the performer identity
  const activePerformer = (currentUser.performerMode && currentUser.activePerformerId)
    ? (currentUser.ownedBrands || []).find(b => b.id === currentUser.activePerformerId && b.account_type === 'performer')
    : null;
  const activePerformerId = activePerformer ? activePerformer.id : null;
  // The identity a post is attributed to via posts.brand_id (brands + performers share this FK)
  const activeAuthorBrandId = activePerformerId || activeBrandId;
  const authorId = activeAuthorBrandId || currentUser.id;
  const { interestGroups } = useContent();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selTags, setSelTags] = useState([]);
  const [selGroup, setSelGroup] = useState(null);
  const [posting, setPosting] = useState(false);
  const [checking, setChecking] = useState(false);
  const fileRef = useRef(null);
  const [cropQueue, setCropQueue] = useState([]);
  const [currentCropFile, setCurrentCropFile] = useState(null);

  const isBrand = currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand' || !!currentUser.managingBrandId || !!activePerformer;
  const maxImages = isBrand ? 8 : 4;

  const toggleTag = tag => setSelTags(prev =>
    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
  );

  const handleImage = e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    if (images.length + files.length > maxImages) {
      toast(`Maximum ${maxImages} images per post (${isBrand ? 'brands' : 'residents'})`, 'error');
      return;
    }
    setCropQueue(files.slice(1));
    setCurrentCropFile(files[0]);
    e.target.value = '';
  };

  const handleCropDone = (previewUrl, croppedFile) => {
    setImages(prev => [...prev, { file: croppedFile, preview: previewUrl }]);
    if (cropQueue.length > 0) {
      setCurrentCropFile(cropQueue[0]);
      setCropQueue(prev => prev.slice(1));
    } else {
      setCurrentCropFile(null);
    }
  };

  const handleCropCancel = () => {
    setCropQueue([]);
    setCurrentCropFile(null);
  };

  const removeImage = index => {
    setImages(prev => prev.filter((_, i) => i !== index));
    if (index === currentImageIndex && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handlePost = async () => {
    if (!caption.trim() && images.length === 0) {
      toast('Add a caption or photo first', 'error');
      return;
    }
    const hasLink = /https?:|secondlife:|slurl\.com/.test(caption);
    if (hasLink) {
      toast('Links and SLurls are not allowed in posts. Use a paid ad to include a teleport link.', 'error');
      return;
    }

    // ── AI moderation check ───────────────────────────────────
    if (caption.trim() || images.length > 0) {
      setChecking(true);
      try {
        let imageBase64 = null;
        let imageMimeType = 'image/jpeg';
        if (images.length > 0 && images[0].file) {
          imageBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const match = reader.result.match(/^data:(image\/\w+);base64,(.+)$/);
              if (match) { imageMimeType = match[1]; resolve(match[2]); }
              else resolve(null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(images[0].file);
          });
        }
        const modRes = await fetch(
          'https://muzzjvegynsemlsbwggf.supabase.co/functions/v1/moderate-post',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: caption.trim() || null, imageBase64, imageMimeType, userId: currentUser.id }),
          }
        );
        const modData = await modRes.json();
        if (modData.result === 'block') {
          toast(modData.reason?.startsWith('CHILD_SAFETY:')
            ? 'This post cannot be published. It has been reported to the InCynq safety team.'
            : 'This post violates InCynq Community Standards and cannot be published.', 'error');
          setChecking(false);
          return;
        }
      } catch (e) {
        console.warn('Moderation check failed (non-fatal):', e.message);
      } finally {
        setChecking(false);
      }
    }

    setPosting(true);
    try {
      let imageUrls = [];

      if (images.length > 0) {
        for (const img of images) {
          try {
            const url = await uploadPostImage(authorId, img.file);
            imageUrls.push(url);
          } catch {
            imageUrls.push(img.preview);
          }
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      let savedPost = null;

      if (session?.user) {
        try {
          savedPost = await createPost({
            userId:    currentUser.id,
            brandId:   activeAuthorBrandId || null,
            caption:   caption.trim(),
            imageUrl:  imageUrls[0] || null,
            imageUrls: imageUrls,
            tags:      selTags,
          });
        } catch (e) {
          console.warn('Supabase post failed, using local:', e.message);
        }
      }

      const newPost = {
        id: savedPost?.id || Date.now(),
        userId: currentUser.id,
        image: imageUrls[0] || null,
        images: imageUrls,
        caption: caption.trim(),
        tags: selTags,
        likes: 0,
        comments: [],
        time: 'just now',
        locationId: null,
        _profile: activePerformer ? {
          username:          activePerformer.username,
          display_name:      activePerformer.brand_name || activePerformer.username,
          brand_name:        activePerformer.brand_name,
          brand_logo_url:    activePerformer.brand_logo_url,
          avatar_url:        activePerformer.brand_logo_url,
          show_display_name: true,
          account_type:      'performer',
        } : activeBrandId ? {
          username: activeBrandId === currentUser.id
            ? currentUser.username
            : (currentUser.managedBrands || []).find(b => b.id === activeBrandId)?.username || currentUser.username,
          display_name: activeBrandId === currentUser.id
            ? currentUser.brandName
            : (currentUser.managedBrands || []).find(b => b.id === activeBrandId)?.brand_name || currentUser.brandName,
          avatar_url: activeBrandId === currentUser.id
            ? currentUser.brandLogoUrl
            : (currentUser.managedBrands || []).find(b => b.id === activeBrandId)?.brand_logo_url || currentUser.brandLogoUrl,
          show_display_name: true,
          account_type: 'brand',
        } : {
          username: currentUser.username,
          display_name: currentUser.displayName,
          avatar_url: currentUser.avatar,
          show_display_name: currentUser.showDisplayName,
        },
      };
      setPosts(prev => [newPost, ...prev]);
      toast('Posted! ✓');
      onClose();
    } catch (e) {
      toast('Failed to post — please try again', 'error');
    } finally {
      setPosting(false);
    }
  };

  const selectedGroupData = interestGroups.find(g => g.id === selGroup);

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 800, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', overflow: 'hidden' }} className="fadeUp">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <button onClick={onClose} style={{ color: C.text, fontSize: 22 }}>✕</button>
        <span className="sg" style={{ fontWeight: 700, fontSize: 17, color: C.text, flex: 1 }}>New Post</span>
        <button
          onClick={handlePost}
          disabled={posting || checking || (!caption.trim() && images.length === 0)}
          style={{ padding: '8px 20px', borderRadius: 20, background: (!caption.trim() && images.length === 0) ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: (!caption.trim() && images.length === 0) ? C.muted : '#060d14', fontWeight: 900, fontSize: 13, transition: 'all .2s' }}>
          {checking ? '🔍 Checking…' : posting ? '⏳' : 'Post'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>

        {/* User + caption */}
        <div style={{ display: 'flex', gap: 12, padding: '16px 16px 0', alignItems: 'flex-start' }}>
          <Av
            src={activePerformer
              ? activePerformer.brand_logo_url
              : activeBrandId
                ? (activeBrandId === currentUser.id
                    ? currentUser.brandLogoUrl
                    : (currentUser.managedBrands || []).find(b => b.id === activeBrandId)?.brand_logo_url || currentUser.brandLogoUrl)
                : currentUser.avatar}
            size={40}
            ring={C.sky}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.text, marginBottom: 6 }}>
              {activePerformer
                ? (activePerformer.brand_name || activePerformer.username)
                : activeBrandId
                  ? (activeBrandId === currentUser.id
                      ? currentUser.brandName
                      : (currentUser.managedBrands || []).find(b => b.id === activeBrandId)?.brand_name || currentUser.brandName)
                  : visibleName(currentUser)}
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's happening on the grid?"
              style={{ width: '100%', background: 'transparent', border: 'none', color: C.text, fontSize: 15, lineHeight: 1.6, resize: 'none', minHeight: 100, outline: 'none', fontFamily: 'inherit' }}
              autoFocus
            />
          </div>
        </div>

        {/* Image carousel */}
        {images.length > 0 && (
          <div style={{ margin: '12px 16px 0', position: 'relative' }}>
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 14 }}>
              <div style={{ display: 'flex', transition: 'transform 0.3s ease', transform: `translateX(-${currentImageIndex * 100}%)` }}>
                {images.map((img, i) => (
                  <div key={i} style={{ minWidth: '100%', position: 'relative' }}>
                    <img src={img.preview} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', filter: checking ? 'blur(6px)' : 'none', transition: 'filter 0.3s ease' }} />
                    {checking && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', zIndex: 3 }}>
                        <svg viewBox="0 0 72 72" style={{ width: 64, height: 64, marginBottom: 8 }}>
                          <circle cx="36" cy="36" r="32" fill="none" stroke="#ff2244" strokeWidth="6" />
                          <line x1="16" y1="16" x2="56" y2="56" stroke="#ff2244" strokeWidth="6" strokeLinecap="round" />
                        </svg>
                        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>Checking content…</span>
                      </div>
                    )}
                    <button
                      onClick={() => removeImage(i)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2, opacity: checking ? 0 : 1 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {images.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      ‹
                    </button>
                  )}
                  {currentImageIndex < images.length - 1 && (
                    <button onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      ›
                    </button>
                  )}
                </>
              )}
            </div>

            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                {images.map((_, i) => (
                  <button key={i} onClick={() => setCurrentImageIndex(i)}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: i === currentImageIndex ? C.sky : `${C.muted}66`, transition: 'all 0.2s', cursor: 'pointer' }} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags section */}
        <div style={{ padding: '16px 16px 8px' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 10 }}>ADD TAGS</div>

          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 8 }}>
            {interestGroups.map(g => (
              <button key={g.id} onClick={() => setSelGroup(selGroup === g.id ? null : g.id)}
                style={{ flexShrink: 0, fontSize: 11, padding: '5px 11px', borderRadius: 20, fontWeight: 700,
                  border: `1.5px solid ${selGroup === g.id ? g.color : C.border}`,
                  background: selGroup === g.id ? `${g.color}22` : 'transparent',
                  color: selGroup === g.id ? g.color : C.muted,
                  whiteSpace: 'nowrap', transition: 'all .15s' }}>
                {g.label}
              </button>
            ))}
          </div>

          {selectedGroupData && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '10px 12px', background: C.card2, borderRadius: 12, marginBottom: 8, paddingBottom: 12 }}>
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
        <button
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= maxImages}
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: images.length >= maxImages ? C.muted : C.sky, fontSize: 13, fontWeight: 700 }}>
          <span style={{ fontSize: 20 }}>📷</span>
          {images.length > 0 ? `Photo (${images.length}/${maxImages})` : 'Photo'}
        </button>
        <div style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>
          {caption.length > 0 && `${caption.length} chars`}
        </div>
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImage} />

      {currentCropFile && (
        <ImageCropModal
          file={currentCropFile}
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
