<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { init_ingame } from "../routes/ingame/ingame.js";
import ingameHtml from "../routes/ingame/ingame.html?raw";

const root = ref(null);
const router = useRouter();
const route = useRoute();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = ingameHtml;
        setTimeout(() => {
            init_ingame({
                onComplete: () => router.push({ name: "maze", query: { ...route.query } }),
            });
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load the match.</p>';
    }
});
</script>

<style src="../routes/ingame/ingame.css"></style>
