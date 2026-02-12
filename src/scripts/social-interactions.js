
// Web Component for Social Interactions
class BlogSocialInteractions extends HTMLElement {
  constructor() {
    super();
    this.initialized = false;
  }

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    this.postId = this.dataset.postId;
    this.postTitle = this.dataset.postTitle;

    if (!this.postId) {
      console.warn("BlogSocialInteractions: No postId provided.");
      return;
    }

    this.render();
    this.initFirebase();
  }

  render() {
    this.innerHTML = `
      <div class="social-interactions mt-6 text-deep-green/80">
        <div class="flex items-center gap-6 border-t border-sage/10 pt-4">
          <!-- Like Button -->
          <button
            class="like-btn flex items-center gap-2 hover:text-sage transition-colors group"
            aria-label="Me gusta"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6 group-[.liked]:fill-sage group-[.liked]:text-sage transition-all"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
              ></path>
            </svg>
            <span class="like-count font-serif text-lg">0</span>
          </button>

          <!-- Comment Toggle -->
          <button
            class="comment-toggle-btn flex items-center gap-2 hover:text-sage transition-colors"
            aria-label="Ver comentarios"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="w-6 h-6"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 20.25c4.97 0 9-3.69 9-8.25s-4.03-8.25-9-8.25S3 7.44 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 0 1-.923 1.785A5.969 5.969 0 0 0 6 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337Z"
              ></path>
            </svg>
            <span class="comment-count font-serif text-lg">0</span>
          </button>
        </div>

        <!-- Comments Section -->
        <div class="comments-section hidden mt-6 space-y-6">
          <div class="comments-list space-y-4">
            <p class="no-comments-msg text-center text-sm italic opacity-60">
              Sé el primero en comentar.
            </p>
          </div>

          <!-- Auth Guard for New Comment -->
          <div
            class="auth-required-msg hidden text-center text-sm bg-sage/10 p-4 rounded-xl"
          >
            <p>Inicia sesión para participar en la conversación.</p>
          </div>

          <!-- New Comment Form -->
          <form class="new-comment-form hidden space-y-3">
            <textarea
              class="w-full rounded-xl border border-sage/20 bg-white/50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage/20 resize-none"
              rows="2"
              placeholder="Escribe un comentario..."
              required></textarea>
            <div class="flex justify-end">
              <button
                type="submit"
                class="px-4 py-1.5 bg-sage text-white text-sm font-semibold rounded-full hover:bg-sage/90 transition-colors disabled:opacity-50"
              >
                Publicar
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  async initFirebase() {
    // @ts-ignore
    const firebaseConfig = window.__FIREBASE_CONFIG__;
    if (!firebaseConfig) {
      console.warn("Firebase config not found. Social interactions disabled.");
      return;
    }

    try {
      const [firebaseApp, firebaseAuth, firebaseFirestore] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"),
      ]);

      const { initializeApp, getApps, getApp } = firebaseApp;
      const { getAuth, onAuthStateChanged } = firebaseAuth;
      const { getFirestore } = firebaseFirestore;

      const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      const auth = getAuth(app);
      const db = getFirestore(app);

      this.setupLogic(auth, db, firebaseFirestore, onAuthStateChanged);
    } catch (e) {
      console.error("Error initializing social interactions:", e);
    }
  }

  setupLogic(auth, db, firestoreOps, onAuthStateChanged) {
    const {
      collection,
      query,
      where,
      orderBy,
      onSnapshot,
      addDoc,
      setDoc,
      deleteDoc,
      doc,
      serverTimestamp,
    } = firestoreOps;

    const likeBtn = this.querySelector(".like-btn");
    const likeCountSpan = this.querySelector(".like-count");
    const commentToggleBtn = this.querySelector(".comment-toggle-btn");
    const commentCountSpan = this.querySelector(".comment-count");
    const commentsSection = this.querySelector(".comments-section");
    const commentsList = this.querySelector(".comments-list");
    const noCommentsMsg = this.querySelector(".no-comments-msg");
    const newCommentForm = this.querySelector(".new-comment-form");
    const authRequiredMsg = this.querySelector(".auth-required-msg");

    let currentUser = null;

    // --- Auth UI ---
    const updateAuthUI = (user) => {
      currentUser = user;
      if (user) {
        newCommentForm.classList.remove("hidden");
        authRequiredMsg.classList.add("hidden");
        checkUserLike();
      } else {
        newCommentForm.classList.add("hidden");
        authRequiredMsg.classList.remove("hidden");
        likeBtn.classList.remove("liked");
      }
    };

    onAuthStateChanged(auth, updateAuthUI);

    // --- Likes ---
    let currentLikeSnapshot = null;

    const subscribeToLikes = () => {
      const q = query(collection(db, "likes"), where("postId", "==", this.postId));
      onSnapshot(q, (snapshot) => {
        likeCountSpan.textContent = snapshot.size;
        currentLikeSnapshot = snapshot;
        checkUserLike();
      });
    };

    const checkUserLike = () => {
      if (!currentUser || !currentLikeSnapshot) return;
      const isLiked = currentLikeSnapshot.docs.some(
        (d) => d.data().userId === currentUser.uid
      );
      likeBtn.classList.toggle("liked", isLiked);
    };

    likeBtn.addEventListener("click", async () => {
      if (!currentUser) {
        alert("Debes iniciar sesión para dar me gusta.");
        return;
      }
      const likeDocId = `${this.postId}_${currentUser.uid}`;
      const likeRef = doc(db, "likes", likeDocId);
      const isLiked = likeBtn.classList.contains("liked");

      try {
        if (isLiked) {
          await deleteDoc(likeRef);
        } else {
          await setDoc(likeRef, {
            postId: this.postId,
            userId: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch (e) {
        console.error("Error toggling like:", e);
      }
    });

    // --- Comments ---
    const subscribeToComments = () => {
      const q = query(
        collection(db, "comments"),
        where("postId", "==", this.postId),
        orderBy("createdAt", "asc")
      );

      onSnapshot(q, (snapshot) => {
        const comments = [];
        snapshot.forEach((doc) => {
          comments.push({ id: doc.id, ...doc.data() });
        });
        commentCountSpan.textContent = comments.length;
        renderComments(comments);
      });
    };

    const renderComments = (comments) => {
      commentsList.innerHTML = "";
      if (comments.length === 0) {
        commentsList.appendChild(noCommentsMsg);
        noCommentsMsg.classList.remove("hidden");
        return;
      }
      noCommentsMsg.classList.add("hidden");

      const rootComments = comments.filter((c) => !c.parentId);
      const replies = comments.filter((c) => c.parentId);

      rootComments.forEach((comment) => {
        const commentEl = this.createCommentElement(
          comment,
          false,
          currentUser,
          db,
          collection,
          addDoc,
          serverTimestamp,
          doc,
          deleteDoc
        );
        commentsList.appendChild(commentEl);

        const childReplies = replies.filter((r) => r.parentId === comment.id);
        if (childReplies.length > 0) {
          const repliesContainer = commentEl.querySelector(".replies-list");
          repliesContainer.classList.remove("hidden");
          childReplies.forEach((reply) => {
            const replyEl = this.createCommentElement(
              reply,
              true,
              currentUser,
              db,
              collection,
              addDoc,
              serverTimestamp,
              doc,
              deleteDoc
            );
            repliesContainer.appendChild(replyEl);
          });
        }
      });
    };

    // Toggle comments
    commentToggleBtn.addEventListener("click", () => {
      commentsSection.classList.toggle("hidden");
    });

    // New Comment
    newCommentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const textarea = newCommentForm.querySelector("textarea");
      const content = textarea.value.trim();
      const btn = newCommentForm.querySelector("button[type='submit']");

      if (!content) return;
      btn.disabled = true;

      try {
        await addDoc(collection(db, "comments"), {
          postId: this.postId,
          title: this.postTitle,
          authorId: currentUser.uid,
          authorName: currentUser.displayName || currentUser.email.split("@")[0],
          content,
          createdAt: serverTimestamp(),
        });
        textarea.value = "";
      } catch (err) {
        console.error("Error posting comment:", err);
        alert("No se pudo publicar el comentario.");
      } finally {
        btn.disabled = false;
      }
    });

    subscribeToLikes();
    subscribeToComments();
  }

  createCommentElement(
    data,
    isReply,
    currentUser,
    db,
    collection,
    addDoc,
    serverTimestamp,
    doc,
    deleteDoc
  ) {
    const el = document.createElement("div");
    el.className = "comment-item p-4 bg-white/60 rounded-xl border border-sage/10";
    el.dataset.id = data.id;

    // Date formatting
    let dateStr = "";
    if (data.createdAt) {
      const date = data.createdAt.toDate ? data.createdAt.toDate() : new Date();
      dateStr =
        date.toLocaleDateString() +
        " " +
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    el.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <span class="author-name font-bold text-sm text-deep-green">${
          data.authorName || "Anónimo"
        }</span>
        <span class="comment-date text-xs text-sage">${dateStr}</span>
      </div>
      <p class="comment-body text-sm text-deep-green/90 leading-relaxed whitespace-pre-wrap">${
        data.content
      }</p>
    `;
      
    // Actions
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "mt-3 flex gap-4 text-xs font-semibold items-center";
    
    // Reply Button
    if (!isReply) {
      const replyBtn = document.createElement("button");
      replyBtn.className = "reply-btn text-sage hover:underline";
      replyBtn.textContent = "Responder";
      actionsDiv.appendChild(replyBtn);
      
      // ... Reply Logic (moved below)
    }

    // Delete Button (only if author)
    if (currentUser && currentUser.uid === data.authorId) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "text-red-400 hover:text-red-600 hover:underline";
      deleteBtn.textContent = "Eliminar";
      deleteBtn.addEventListener("click", async () => {
        if (!confirm("¿Seguro que quieres borrar este comentario?")) return;
        try {
          await deleteDoc(doc(db, "comments", data.id));
        } catch (e) {
          console.error("Error deleting comment:", e);
          alert("No se pudo borrar el comentario.");
        }
      });
      actionsDiv.appendChild(deleteBtn);
    }
    
    el.appendChild(actionsDiv);

    // Reply Form Container (only if not reply)
    if (!isReply) {
       const replyContainer = document.createElement("div");
       replyContainer.className = "reply-form-container mt-3 hidden pl-4 border-l-2 border-sage/20";
       replyContainer.innerHTML = `
         <form class="reply-comment-form space-y-2">
           <textarea
             class="w-full rounded-lg border border-sage/20 bg-white p-2 text-xs focus:outline-none focus:ring-2 focus:ring-sage/20 resize-none"
             rows="2"
             placeholder="Escribe tu respuesta..."
             required></textarea>
           <div class="flex justify-end gap-2">
             <button type="button" class="cancel-reply-btn text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
             <button type="submit" class="px-3 py-1 bg-sage text-white text-xs font-semibold rounded-full hover:bg-sage/90 transition-colors disabled:opacity-50">Responder</button>
           </div>
         </form>
       `;
       el.appendChild(replyContainer);

       const repliesList = document.createElement("div");
       repliesList.className = "replies-list mt-3 pl-4 border-l-2 border-sage/10 space-y-3 hidden";
       el.appendChild(repliesList);

       // Event Listeners for Reply
       const replyBtn = actionsDiv.querySelector(".reply-btn");
       const replyForm = replyContainer.querySelector(".reply-comment-form");
       const cancelBtn = replyContainer.querySelector(".cancel-reply-btn");

       replyBtn.addEventListener("click", () => {
        if (!currentUser) {
          alert("Inicia sesión para responder.");
          return;
        }
        replyContainer.classList.remove("hidden");
      });

      cancelBtn.addEventListener("click", () => {
        replyContainer.classList.add("hidden");
        replyForm.reset();
      });

      replyForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const content = replyForm.querySelector("textarea").value.trim();
        if (!content) return;

        const btn = replyForm.querySelector("button[type='submit']");
        btn.disabled = true;

        try {
          await addDoc(collection(db, "comments"), {
            postId: this.postId,
            title: this.postTitle,
            authorId: currentUser.uid,
            authorName:
              currentUser.displayName || currentUser.email.split("@")[0],
            content,
            parentId: data.id,
            createdAt: serverTimestamp(),
          });
          replyForm.reset();
          replyContainer.classList.add("hidden");
        } catch (err) {
          console.error("Error replying:", err);
          alert("Error al enviar la respuesta.");
        } finally {
          btn.disabled = false;
        }
      });
    }

    return el;
  }
}

customElements.define("blog-social-interactions", BlogSocialInteractions);
