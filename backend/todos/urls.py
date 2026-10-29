from django.urls import path
from . import views

urlpatterns = [
    path('health/', views.health_check, name='health_check'),
    path('stats/', views.stats_view, name='stats_view'),
    path('todos/', views.todo_list_create, name='todo_list_create'),
    path('todos/<int:todo_id>/', views.todo_detail_update_delete, name='todo_detail_update_delete'),
    path('todos/seed/', views.seed_sample_todos, name='seed_sample_todos'),
    path('todos/clear-completed/', views.clear_completed_todos, name='clear_completed_todos'),
]
