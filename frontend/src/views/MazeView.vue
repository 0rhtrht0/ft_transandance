<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_maze } from "../routes/ingame/ingame.js";
import mazeHtml from "../routes/ingame/maze.html?raw";

const root = ref(null);
const router = useRouter();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = mazeHtml;
        setTimeout(() => {
            init_maze({
                onQuit: () => router.push({ name: "menu" })
            });
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load the match.</p>';
    }
});
</script>

<style src="../routes/ingame/maze.css"></style>
