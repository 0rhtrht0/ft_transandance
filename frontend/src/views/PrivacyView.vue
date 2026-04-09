<template>
  <main class="legal-page">
    <div class="parallax-bg"></div>
    <div class="legal-container">
      <header class="legal-header">
        <AppIcon name="shield" :size="48" class="header-icon" />
        <h1>Privacy Policy</h1>
        <p class="last-updated">Last updated: April 2026</p>
      </header>

      <section class="legal-content">
        
        <div class="policy-block">
          <h2>1. Scope and Controller</h2>
          <p>
            This Privacy Policy explains how BlackHole collects, uses, stores, and protects personal data when you access or use our game platform. For the purpose of applicable privacy regulations, BlackHole acts as the data controller for account, gameplay, and platform operation data.
          </p>
        </div>

        <div class="policy-block">
          <h2>2. Data We Collect</h2>
          <p>
            We collect only data required to provide and secure the service:
          </p>
          <ul>
            <li><strong>Account data:</strong> username, profile image, and authentication identifiers (including OAuth-based identity data where applicable).</li>
            <li><strong>Session and security data:</strong> login timestamps, token/session metadata, and anti-abuse/security logs.</li>
            <li><strong>Gameplay data:</strong> match history, progression, leaderboard-related metrics, room participation, and in-game outcomes.</li>
            <li><strong>Technical data:</strong> basic client/network diagnostics required for reliability, fraud prevention, and troubleshooting.</li>
          </ul>
        </div>

        <div class="policy-block">
          <h2>3. How We Use Data</h2>
          <p>Your data is processed for the following purposes:</p>
          <ul>
            <li>Account authentication and secure access control.</li>
            <li>Matchmaking, multiplayer synchronization, and game state integrity.</li>
            <li>Progression tracking, rewards, rankings, and anti-cheat enforcement.</li>
            <li>Service monitoring, incident response, and platform performance improvements.</li>
            <li>Legal compliance and protection against fraud, abuse, or unauthorized access.</li>
          </ul>
        </div>

        <div class="policy-block">
          <h2>4. Legal Bases for Processing</h2>
          <p>
            Depending on your jurisdiction, we rely on one or more of the following legal bases: performance of a contract (service delivery), legitimate interests (security and service quality), compliance with legal obligations, and consent where required.
          </p>
        </div>

        <div class="policy-block">
          <h2>5. Authentication, Cookies, and Tokens</h2>
          <p>
            We use security-focused session mechanisms (including secure tokens/cookies) required to keep you signed in and protect your account. We do not use advertising trackers as part of core gameplay functionality. Disabling required cookies may prevent access to certain features.
          </p>
        </div>

        <div class="policy-block">
          <h2>6. Data Retention</h2>
          <p>
            We retain personal data only for as long as necessary for the purposes described in this policy, including account lifecycle, dispute handling, security investigations, and legal compliance. Where possible, data is deleted or anonymized after retention periods expire.
          </p>
        </div>

        <div class="policy-block">
          <h2>7. Data Sharing and International Transfers</h2>
          <p>
            We do not sell your personal data. Data may be shared with infrastructure and service providers strictly for platform operation (hosting, security, analytics, communications), under contractual safeguards. If international transfers occur, appropriate protections are applied.
          </p>
        </div>

        <div class="policy-block">
          <h2>8. Security Measures</h2>
          <p>
            We implement technical and organizational safeguards including encrypted transport, access controls, credential protection, and logging/monitoring. No system is absolutely secure, but we continuously improve our controls to reduce risk.
          </p>
        </div>

        <div class="policy-block">
          <h2>9. Your Rights</h2>
          <p>
            Subject to applicable law, you may have rights to access, rectify, erase, restrict, object, or port your personal data. You may also withdraw consent where processing is consent-based. To exercise these rights, contact us through the support channel available in the application.
          </p>
        </div>

        <div class="policy-block">
          <h2>10. Children and Minors</h2>
          <p>
            The service is not intended for users below the minimum age required by applicable law without parental/guardian authorization. If we become aware of unlawful collection of a minor's data, we will take appropriate corrective action.
          </p>
        </div>

        <div class="policy-block">
          <h2>11. Policy Updates</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated through the platform or other appropriate channels. Continued use of the service after an update means you acknowledge the revised policy.
          </p>
        </div>
      </section>

      <footer class="legal-actions">
        <button class="back-btn" @click="$router.push('/menu')">
          BACK TO MENU
        </button>
      </footer>
    </div>
  </main>
</template>

<script setup>
import AppIcon from '@/components/ui/AppIcon.vue'
</script>

<style scoped>
.legal-page {
  min-height: 100vh;
  background: #000000;
  color: #e2e8f0;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 60px 20px;
  font-family: 'Orbitron', 'Inter', sans-serif;
  position: relative;
  overflow-y: auto;
}

.parallax-bg {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, #111111 0%, #000000 100%);
  z-index: 0;
}

.legal-container {
  position: relative;
  z-index: 1;
  max-width: 850px;
  width: 100%;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(150, 150, 150, 0.4);
  border-radius: 16px;
  padding: 50px;
  box-shadow: 0 0 50px rgba(100, 100, 100, 0.15), inset 0 0 20px rgba(200, 200, 200, 0.1);
}

.legal-header {
  text-align: center;
  margin-bottom: 40px;
  border-bottom: 1px solid rgba(150, 150, 150, 0.3);
  padding-bottom: 20px;
}

.header-icon {
  color: #d4d4d4;
  margin-bottom: 15px;
  filter: drop-shadow(0 0 15px rgba(200, 200, 200, 0.8));
}

h1 {
  font-size: 2.5rem;
  letter-spacing: 3px;
  margin: 0;
  color: #ffffff;
  text-transform: uppercase;
  text-shadow: 0 0 10px rgba(200, 200, 200, 0.6), 0 0 20px rgba(150, 150, 150, 0.5);
}

.last-updated {
  color: rgba(226, 232, 240, 0.5);
  font-size: 0.9rem;
  margin-top: 10px;
}

.legal-content {
  display: grid;
  gap: 30px;
}

.policy-block h2 {
  color: #eeeeee;
  font-size: 1.3rem;
  letter-spacing: 1.5px;
  margin-bottom: 15px;
  text-transform: uppercase;
  text-shadow: 0 0 8px rgba(200, 200, 200, 0.5);
}

.policy-block p, .policy-block ul {
  line-height: 1.7;
  color: #cbd5e1;
  font-family: 'Inter', sans-serif;
  font-size: 1rem;
}

.policy-block ul {
  padding-left: 20px;
  margin-top: 10px;
}

.policy-block li {
  margin-bottom: 8px;
}

.policy-block strong {
  color: #f8fafc;
  text-shadow: 0 0 5px rgba(255,255,255,0.3);
}

.legal-actions {
  margin-top: 50px;
  text-align: center;
}

.back-btn {
  background: linear-gradient(135deg, rgba(150, 150, 150, 0.15), rgba(100, 100, 100, 0.15));
  border: 1px solid #a3a3a3;
  color: #ffffff;
  padding: 14px 36px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: 'Orbitron', sans-serif;
  font-weight: 700;
  letter-spacing: 2px;
  box-shadow: 0 0 15px rgba(150, 150, 150, 0.3);
}

.back-btn:hover {
  background: linear-gradient(135deg, rgba(150, 150, 150, 0.4), rgba(100, 100, 100, 0.4));
  box-shadow: 0 0 25px rgba(150, 150, 150, 0.6), 0 0 15px rgba(200, 200, 200, 0.6);
  transform: translateY(-2px);
}

@media (max-width: 600px) {
  .legal-container {
    padding: 30px 20px;
  }
  h1 {
    font-size: 1.8rem;
  }
}
</style>
