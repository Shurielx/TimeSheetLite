# TimeSheetLite 1.3.0

Generator miesięcznych list obecności do druku i zapisu jako PDF. Wpisy pozostają lokalnie w przeglądarce.

**[Otwórz aplikację](https://shurielx.github.io/TimeSheetLite/)** · [English](README.md) · [Historia zmian](CHANGELOG.md)

## Wprowadzanie danych

1. Wybierz miesiąc i rok. Opcjonalnie nadaj arkuszowi własny tytuł.
2. Kliknij pole tabeli lub włącz **Tryb edycji**. Nad tabelą zobaczysz datę, osobę i kolumnę aktualnie edytowanego pola. Wybrane pole ma wyraźną obwódkę.
3. Dodaj osoby, zmień ich nazwy, kolejność i względną szerokość grupy. Można dodać do 100 osób.
4. W **Układzie tabeli** dodaj własne kolumny: tekst/podpis lub godziny od 0 do 24. Każda kolumna godzin ma niezależną sumę. Dostępnych jest do 12 kolumn powtarzanych dla każdej osoby.
5. Zmień nazwy, kolejność i proporcje kolumn. Szerokość 2 daje dwa razy więcej miejsca niż 1. Przy wąskich proporcjach podgląd przewija się poziomo, aby zachować czytelność.

Enter i strzałka w dół przechodzą do kolejnego dnia, Shift+Enter i strzałka w górę do poprzedniego. Tab przechodzi do następnego pola. Opisy przełączników można klikać tak samo jak same przełączniki.

**Wypełnij dni robocze (8h)** uzupełnia wyłącznie puste pola godzin w widocznych kolumnach. Zachowuje istniejące wpisy. Dni wolne uwzględniają weekendy, święta dla wybranego kraju oraz ręczne oznaczenia.

## Ukrywanie i usuwanie

Układ kolumn i lista osób są wspólne dla wszystkich miesięcy. Wpisy pozostają przypisane do konkretnej osoby i daty po zmianie kolejności.

- **Ukrycie kolumny** zachowuje wpisy w przeglądarce i kopiach JSON. Kolumna znika z arkusza, wydruku i CSV.
- **Usunięcie kolumny lub osoby** usuwa jej wpisy ze wszystkich miesięcy po potwierdzeniu.
- **Wyczyść miesiąc** usuwa wpisy wszystkich kolumn w wybranym miesiącu, również ukrytych.

Przed usuwaniem danych wyeksportuj kopię JSON.

## Drukowanie

Wybierz orientację pionową lub poziomą i kliknij **Drukuj / Zapisz PDF**. W oknie przeglądarki ustaw A4, skalę 100% i wyłącz nagłówki oraz stopki przeglądarki. Aplikacja ustawia marginesy 6 mm.

Standardowy arkusz dla trzech osób, z dwiema równymi kolumnami i miesiącem 28–31 dni, mieści się na jednej stronie A4 przy domyślnych ustawieniach w obu orientacjach. Szersze tabele są dzielone na części z powtórzonymi datami i nagłówkami. Długi tekst jest zawijany. Większa czcionka, wyższe wiersze lub długie wpisy mogą wymagać kolejnych stron.

Licznik nad tabelą podaje liczbę części wynikających z szerokości tabeli, a nie końcową liczbę kartek. Podgląd na ekranie służy do edycji; rzeczywisty układ wydruku sprawdzisz w oknie druku. Przycisk aplikacji i Ctrl+P przygotowują tę samą tabelę.

Układ PDF jest testowany w Chromium, także przy czcionce 12 pt, wysokich wierszach i długich opisach. Fizyczna drukarka lub inny silnik przeglądarki mogą stosować inne ograniczenia marginesów.

## Zapis i kopie

Dane są zapisywane automatycznie w przeglądarce na danym urządzeniu. W **Ustawieniach** wyeksportujesz lub zaimportujesz kopię JSON. Kopia zawiera wpisy wszystkich miesięcy oraz układ tabeli. Starsze kopie z kolumnami stanu i godzin są migrowane przy imporcie. Eksport CSV zawiera widoczne kolumny bieżącego miesiąca.

W obsługiwanych przeglądarkach Chromium na HTTPS można również wybrać lokalny plik JSON. Błędy zapisu pliku są sygnalizowane; dane pozostają zapisane w przeglądarce. Obsługa systemowego wyboru pliku jest testowana za pomocą atrap API, bez automatyzowania okien uprawnień systemu.

Przed wyczyszczeniem danych przeglądarki lub zmianą urządzenia wykonaj eksport. Dane i kopie nie są szyfrowane. Szczegóły opisuje [polityka prywatności](PRIVACY.pl.md).

Instrukcja uruchamiania testów i opis wdrożenia znajdują się w [README](README.md#development-checks).
