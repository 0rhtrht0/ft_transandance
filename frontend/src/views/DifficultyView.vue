<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_difficulty } from "../routes/difficulty/difficulty.js";
import difficultyTemplate from "../routes/difficulty/difficulty.html?raw";

const root = ref(null);
const router = useRouter();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = difficultyTemplate;
        setTimeout(() => {
            init_difficulty((route) => router.push({ name: route }));
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load this page. Please try again.</p>';
    }
});
</script>

<style src="../routes/difficulty/difficulty.css"></style>
