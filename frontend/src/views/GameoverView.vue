<template>
    <div ref="root"></div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { init_gameover } from "../routes/gameover/gameover.js";
import gameoverHtml from "../routes/gameover/gameover.html?raw";

const root = ref(null);
const router = useRouter();

onMounted(() => {
    if (!root.value) {
        return;
    }

    try {
        root.value.innerHTML = gameoverHtml;
        setTimeout(() => {
            init_gameover((target) => {
                if (typeof target === "string") {
                    router.push({ name: target });
                    return;
                }
                router.push(target);
            });
        }, 50);
    } catch (error) {
        console.error(error);
        root.value.innerHTML = '<p style="color: #f5f5f5;">Unable to load the end screen.</p>';
    }
});
</script>

<style src="../routes/gameover/gameover.css"></style>
