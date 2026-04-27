const boutonMenu = document.querySelector(".menu-toggle")
const liensMenu = document.querySelector(".nav-links")

boutonMenu.addEventListener("click", () => {
  liensMenu.classList.toggle("active")

  if (liensMenu.classList.contains("active")) {
    boutonMenu.textContent = "✕"
  } else {
    boutonMenu.textContent = "☰"
  }
})