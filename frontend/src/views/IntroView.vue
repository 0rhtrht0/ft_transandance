<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_intro } from "../routes/intro/intro.js";

const root = ref(null);
const router = useRouter();

onMounted(async () => {
    if (!root.value) {
        return;
    }

    try {
        const response = await fetch("/src/routes/intro/intro.html");
        if (!response.ok) {
            throw new Error(`Failed to load intro route (${response.status})`);
        }

        root.value.innerHTML = await response.text();
        init_intro((route) => router.push({ name: route }));
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load this page. Please try again.</p>';
    }
});
</script>

<style src="../routes/intro/intro.css"></style>
