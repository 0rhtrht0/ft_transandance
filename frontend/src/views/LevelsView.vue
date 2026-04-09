<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_levels } from "../routes/levels/levels.js";
import levelsTemplate from "../routes/levels/levels.html?raw";

const root = ref(null);
const router = useRouter();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = levelsTemplate;
        setTimeout(() => {
            init_levels((route) => router.push({ name: route }));
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load this page. Please try again.</p>';
    }
});
</script>

<style src="../routes/levels/levels.css"></style>
