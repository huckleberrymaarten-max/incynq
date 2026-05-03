import { useState, useRef } from 'react';
import C from '../theme';
import { useApp } from '../context/AppContext';
import { useContent } from '../context/ContentContext';
import { visibleName } from '../data';
import { createPost, uploadPostImage } from '../lib/db';
import { supabase } from '../lib/supabase';
import Av from './Av';
import SLCharPicker from './SLCharPicker';
import ImageCropModal from './ImageCropModal';

export default function ComposeScreen({ onClose }) {
  const { currentUser, posts, setPosts, toast } = useApp();

  // In brand mode, post as the active brand (own or managed)
  const activeBrandId = currentUser.brandMode
    ? (currentUser.managingBrandId || (
        (currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand')
          ? currentUser.id : null
      ))
    : null;
  const authorId = activeBrandId || currentUser.id;
  const { interestGroups } = useContent();
  const [caption, setCaption] = useState('');
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selTags, setSelTags] = useState([]);
  const [selGroup, setSelGroup] = useState(null);
  const [showCharPicker, setShowCharPicker] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const [cropQueue, setCropQueue] = useState([]);
  const [currentCropFile, setCurrentCropFile] = useState(null);

  // Max images based on account type
  const isBrand = currentUser.accountType === 'brand' || currentUser.accountType === 'founding_brand' || !!currentUser.managingBrandId;
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
    // Queue all selected files for cropping one by one
    setCropQueue(files.slice(1));
    setCurrentCropFile(files[0]);
    // Reset input so same file can be selected again
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
    // Reset to first image if we removed the current one
    if (index === currentImageIndex && currentImageIndex > 0) {
      setCurrentImageIndex(currentImageIndex - 1);
    }
  };

  const handlePost = async () => {
    if (!caption.trim() && images.length === 0) {
      toast('Add a caption or photo first', 'error');
      return;
    }
    // Block links and SLurls
    const hasLink = /https?:|secondlife:|slurl\.com/.test(caption);
    if (hasLink) {
      toast('Links and SLurls are not allowed in posts. Use a paid ad to include a teleport link.', 'error');
      return;
    }
    setPosting(true);
    try {
      let imageUrls = [];

      // Upload all images to Supabase Storage if provided
      if (images.length > 0) {
        for (const img of images) {
          try {
            const url = await uploadPostImage(authorId, img.file);
            imageUrls.push(url);
          } catch {
            // Fall back to base64 preview if upload fails
            imageUrls.push(img.preview);
          }
        }
      }

      // Save post to Supabase
      const { data: { session } } = await supabase.auth.getSession();
      let savedPost = null;

      if (session?.user) {
        try {
          savedPost = await createPost({
            userId:    currentUser.id,
            brandId:   activeBrandId || null,
            caption:   caption.trim(),
            imageUrl:  imageUrls[0] || null,
            imageUrls: imageUrls,
            tags:      selTags,
          });
        } catch (e) {
          console.warn('Supabase post failed, using local:', e.message);
        }
      }

      // Add to local feed immediately
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
        _profile: activeBrandId ? {
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
          disabled={posting || (!caption.trim() && images.length === 0)}
          style={{ padding: '8px 20px', borderRadius: 20, background: (!caption.trim() && images.length === 0) ? C.border : `linear-gradient(135deg,${C.sky},${C.peach})`, color: (!caption.trim() && images.length === 0) ? C.muted : '#060d14', fontWeight: 900, fontSize: 13, transition: 'all .2s' }}>
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

          </div>
        </div>

        {/* Image carousel with dots */}
        {images.length > 0 && (
          <div style={{ margin: '12px 16px 0', position: 'relative' }}>
            {/* Carousel container */}
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 14 }}>
              <div 
                style={{ 
                  display: 'flex', 
                  transition: 'transform 0.3s ease',
                  transform: `translateX(-${currentImageIndex * 100}%)`
                }}>
                {images.map((img, i) => (
                  <div key={i} style={{ minWidth: '100%', position: 'relative' }}>
                    <img src={img.preview} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover' }} />
                    <button
                      onClick={() => removeImage(i)}
                      style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Navigation arrows (only if multiple images) */}
              {images.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button
                      onClick={() => setCurrentImageIndex(currentImageIndex - 1)}
                      style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      ‹
                    </button>
                  )}
                  {currentImageIndex < images.length - 1 && (
                    <button
                      onClick={() => setCurrentImageIndex(currentImageIndex + 1)}
                      style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', width: 32, height: 32, borderRadius: '50%', background: '#000000aa', color: 'white', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                      ›
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Dots indicator (Instagram style) */}
            {images.length > 1 && (
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 8 }}>
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentImageIndex(i)}
                    style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: i === currentImageIndex ? C.sky : `${C.muted}66`,
                      transition: 'all 0.2s',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tags section */}
        <div style={{ padding: '16px 16px 8px' }}>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 700, letterSpacing: .5, marginBottom: 10 }}>ADD TAGS</div>

          {/* Group selector — label only, no icons */}
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

          {/* Tags for selected group */}
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

      {/* SL Char Picker — centred overlay */}
      {currentCropFile && (
        <ImageCropModal
          file={currentCropFile}
          onCrop={handleCropDone}
          onCancel={handleCropCancel}
        />
      )}

      {showCharPicker && (
        <div style={{ position: 'absolute', inset: 0, background: '#000000aa', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowCharPicker(false)}>
          <div style={{ width: '100%', maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <SLCharPicker onInsert={c => setCaption(p => p + c)} onClose={() => setShowCharPicker(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
