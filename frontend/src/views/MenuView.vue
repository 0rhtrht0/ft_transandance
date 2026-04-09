<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_menu } from "../routes/menu/menu.js";
import menuHtml from "../routes/menu/menu.html?raw";

const root = ref(null);
const router = useRouter();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = menuHtml;
        setTimeout(() => {
            init_menu((route) => router.push({ name: route }));
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load this page. Please try again.</p>';
    }
});
</script>

<style src="../routes/menu/menu.css"></style>
