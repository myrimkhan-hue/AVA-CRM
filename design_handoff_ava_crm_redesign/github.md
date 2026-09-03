repo: myrimkhan-hue/AVA-CRM
branch: main
path: frontend/src

## Last sync
date: 2026-09-03T09:23:51Z

### Updated in this project
- Ролевые ограничения перенесены из App.tsx: недоступные разделы скрываются из сайдбара и редиректят на «Перевозки»
- Права взяты из LEAD_ROLES, INVOICE_ROLES, OPERATING_EXPENSE_ROLES, DOCUMENT_ACCESS_ROLES и редиректов DealsRoute/LeadsRoute
- Добавлена тёмная тема с переключателем в шапке (переменные CSS, работает на всех экранах)

### 2026-09-03 (ранее)
- Добавлены новые маршруты: /documents, /operating-expenses, /profile
- Настройки расширены до семи вкладок: типы расходов, шаблоны документов, тексты об оплате

## Screen map
| Экран | Источник в репозитории |
| --- | --- |
| Оболочка, навигация, роли | components/AppLayout.tsx, App.tsx, auth/ProtectedRoute.tsx |
| Вход | pages/LoginPage.tsx |
| Перевозки (список) | pages/TransportationsPage.tsx |
| Карточка перевозки | pages/TransportationDetailPage.tsx |
| Новая перевозка | pages/NewTransportationPage.tsx |
| Сделки (канбан) | pages/DealsPage.tsx |
| Карточка сделки | pages/DealDetailPage.tsx |
| Лиды | pages/LeadsPage.tsx |
| Контрагенты | pages/ContractorsPage.tsx |
| Счета клиентам | pages/InvoicesPage.tsx |
| Заявки на оплату | pages/PaymentRequestsPage.tsx |
| Дашборд | pages/DashboardPage.tsx |
| Кассовый календарь | pages/CashCalendarPage.tsx |
| Отчёты: дебиторка / кредиторка | pages/ReceivablesPage.tsx, pages/PayablesPage.tsx, components/ReportsLayout.tsx |
| Мотивация: моя / сводная | pages/MyMotivationPage.tsx, pages/MotivationReportPage.tsx, components/MotivationLayout.tsx |
| Пользователи | pages/UsersPage.tsx |
| Настройки (7 вкладок) | pages/LegalEntitiesPage.tsx, CurrenciesPage.tsx, OperatingExpenseTypesPage.tsx, MotivationSettingsPage.tsx, WhatsappTemplatesPage.tsx, DocumentTemplatesPage.tsx, DocumentPaymentTextsPage.tsx, components/SettingsLayout.tsx |
| Реестр документов | pages/DocumentsPage.tsx, documents/access.ts |
| Операционные расходы | pages/OperatingExpensesPage.tsx |
| Мой профиль | pages/MyProfilePage.tsx |

## Sync history
### 2026-09-02
- Сверены все маршруты App.tsx, добавлен экран входа
- Мотивация разнесена на «Моя» и «Сводная», отчёты получили четыре вкладки ReportsLayout

### 2026-09-02 (ранее в тот же день)
- Сверка маршрутов и меню; зафиксировано расхождение: в коде горизонтальное меню в шапке, в прототипе левый сайдбар (осознанное решение редизайна)
- Отмечено отсутствие редизайна у настроек, отчётов, колокола уведомлений и WhatsApp-фида

### Первая сборка
- Собран единый прототип редизайна по реальным маршрутам приложения
- Статусы перевозок и сделок, роли и права взяты из кода
