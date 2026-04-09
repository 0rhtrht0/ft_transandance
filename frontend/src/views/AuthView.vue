<template>
    <div ref="root"></div>
    <footer class="cinematic-footer">
        <router-link to="/privacy">Privacy Policy</router-link>
        <span class="footer-sep">/</span>
        <router-link to="/terms">Terms of Service</router-link>
    </footer>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_auth } from "../routes/auth/auth.js";
import authTemplate from "../routes/auth/auth.html?raw";

const root = ref(null);
const router = useRouter();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = authTemplate;
        setTimeout(() => {
            init_auth((route) => router.push({ name: route }));
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load this page. Please try again.</p>';
    }
});
</script>

<style src="../routes/auth/auth.css"></style>

<style scoped>
.cinematic-footer {
    position: fixed;
    bottom: 24px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    z-index: 100;
    font-family: 'Orbitron', sans-serif;
    font-size: 0.75rem;
    letter-spacing: 2px;
}

.cinematic-footer a {
    color: rgba(255, 255, 255, 0.4);
    text-decoration: none;
    transition: color 0.2s ease, text-shadow 0.2s ease;
}

.cinematic-footer a:hover {
    color: #fff;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}

.footer-sep {
    color: rgba(255, 255, 255, 0.2);
}
</style>
