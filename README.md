# 📋 TimeSheetLite

Generuj listę obecności do wydruku — prosto z przeglądarki, bez instalacji.

> Generate printable attendance sheets — straight from your browser, no installation needed.

---

## ✨ Features / Funkcje

- **Dni specjalne** – weekendy i święta automatycznie oznaczone, możliwość ręcznego przełączania
- **Druk / PDF** – wydruk w formacie A4, gotowy na firmową tabelkę
- **Tryb edycji** – wpisuj status i godziny dla każdej osoby, edytuj nazwy dni
- **Własne nazwy pracowników** – dodawaj/usuń, edytuj bezpośrednio w tabeli
- **Dark mode** + ciemny arkusz
- **PL / EN** – pełne wsparcie obu języków
- **Święta** – polskie (lokalnie) lub przez API (Nager.Date, ~40 krajów)
- **Auto-zapis** – wszystko zapisuje się w przeglądarce (`localStorage`)
- **Backup JSON** – eksport/import ustawień, przenoś między komputerami

---

## 🚀 Jak używać / How to use

### 📥 Pobierz / Download

👉 **[Pobierz index.html](https://raw.githubusercontent.com/Shurielx/TimeSheetLite/main/index.html)** — kliknij prawym przyciskiem → *Zapisz jako...*

**albo / or** sklonuj repozytorium:

```bash
git clone https://github.com/Shurielx/TimeSheetLite.git
```

Po prostu otwórz `index.html` w przeglądarce. Żaden serwer nie potrzebny.

> Just open `index.html` in any browser. No server required.

---

## 📸 Zrzut ekranu / Screenshot

![TimeSheetLite preview](https://github.com/user-attachments/assets/b00eccd4-73f2-4e5b-b601-bf68ad2eeb70)

---

## ⚙️ Ustawienia / Settings

| Opcja | Opis |
|-------|------|
| Miesiąc / rok | Wybierz miesiąc lub kliknij 📅 by wrócić do obecnego |
| Nazwa miesiąca | Opcjonalna własna nazwa (np. "LIPIEC 2026") |
| Tryb edycji | Włącz, by edytować dane w tabeli |
| Osoby | Dodawaj lub usuwaj pracowników |
| Język | Polski / English |
| Dark mode | Tryb ciemny interfejsu |
| Ciemny arkusz | Ciemne tło arkusza (przydatne na ekranie) |
| Źródło świąt | Polskie lokalnie lub przez API |
| Backup | Eksport/Import ustawień do pliku JSON |

---

## 🧠 Jak to działa / How it works

Cała apliakcja to jeden plik HTML. Zero zależności, zero serwera.  
Dane przechowuje w `localStorage` przeglądarki — po zamknięciu i ponownym otwarciu wszystko wraca.

Stan zapisywany automatycznie przy każdej zmianie:

- ✅ miesiąc / rok
- ✅ lista pracowników
- ✅ wpisy w tabeli (status, godziny)
- ✅ dni specjalne / normalne
- ✅ dark mode, język, źródło świąt

---

## 📄 Licencja / License

MIT — możesz używać, modyfikować i udostępniać bez ograniczeń.
