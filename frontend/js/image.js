// Image upload — pick file, upload to Cloudinary via backend, return metadata
// Used by chat.js before calling sendMessage

const imageUploader = {
  async upload(file) {
    if (!file) throw new Error('No file selected');
    if (file.size > 10 * 1024 * 1024) throw new Error('Image must be under 10MB');
    if (!file.type.startsWith('image/')) throw new Error('File must be an image');

    const formData = new FormData();
    formData.append('image', file);

    const result = await api.upload('/upload/image', formData);
    return result; // { url, publicId, width, height }
  },

  // Preview before upload (used in compose area)
  previewFile(file, imgEl) {
    const reader = new FileReader();
    reader.onload = (e) => { imgEl.src = e.target.result; };
    reader.readAsDataURL(file);
  },
};

window.imageUploader = imageUploader;
