/* ===========================================================
   SoftData — backend manzillari

   Vercel'ga api/ papkasini deploy qilgach, quyidagi ikkita
   manzilni to'ldiring. Bo'sh qoldirilsa sayt ishlashda davom
   etadi: forma pochta ilovasi orqali yuboradi, AI chat esa
   ichki bilimlar bazasidan javob beradi.

   Bu faylda hech qanday kalit yo'q — kalitlar Vercel'ning
   environment o'zgaruvchilarida turadi.
   =========================================================== */

window.SOFTDATA_API = {
  // masalan: "https://softdata-api.vercel.app/api/form"
  form: "",
  // masalan: "https://softdata-api.vercel.app/api/chat"
  chat: ""
};
