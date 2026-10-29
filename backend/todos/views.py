import json
from datetime import date, datetime
from django.http import JsonResponse, HttpResponseNotFound, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import connection
from django.db.models import Q
from .models import Todo


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None


@csrf_exempt
def health_check(request):
    """
    Returns DB connection status and system info.
    """
    db_ok = False
    error_msg = None
    try:
        connection.ensure_connection()
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            db_version = cursor.fetchone()[0]
        db_ok = True
    except Exception as e:
        db_version = None
        error_msg = str(e)

    db_settings = connection.settings_dict
    return JsonResponse({
        'status': 'healthy' if db_ok else 'degraded',
        'db_connected': db_ok,
        'db_engine': db_settings.get('ENGINE', '').split('.')[-1],
        'db_name': db_settings.get('NAME', ''),
        'db_host': db_settings.get('HOST', ''),
        'db_port': db_settings.get('PORT', ''),
        'db_version': db_version,
        'error': error_msg,
    })


@csrf_exempt
def stats_view(request):
    """
    Returns aggregate statistics for todos.
    """
    total = Todo.objects.count()
    completed = Todo.objects.filter(completed=True).count()
    pending = total - completed
    high_priority = Todo.objects.filter(priority='high', completed=False).count()
    categories = sorted(list(set(c for c in Todo.objects.values_list('category', flat=True) if c)))
    return JsonResponse({
        'total': total,
        'completed': completed,
        'pending': pending,
        'high_priority': high_priority,
        'categories': categories,
    })


@csrf_exempt
def todo_list_create(request):
    if request.method == 'GET':
        qs = Todo.objects.all()

        # Filtering
        completed = request.GET.get('completed')
        if completed in ('true', '1'):
            qs = qs.filter(completed=True)
        elif completed in ('false', '0'):
            qs = qs.filter(completed=False)

        priority = request.GET.get('priority')
        if priority in ('low', 'medium', 'high'):
            qs = qs.filter(priority=priority)

        category = request.GET.get('category')
        if category and category != 'All':
            qs = qs.filter(category=category)

        search = request.GET.get('search', '').strip()
        if search:
            qs = qs.filter(Q(title__icontains=search) | Q(description__icontains=search))

        ordering = request.GET.get('ordering', '-created_at')
        allowed_orderings = ['created_at', '-created_at', 'due_date', '-due_date', 'title', '-title', 'priority', '-priority']
        if ordering in allowed_orderings:
            qs = qs.order_by(ordering)

        todos_data = [t.to_dict() for t in qs]
        return JsonResponse(todos_data, safe=False)

    elif request.method == 'POST':
        try:
            body = json.loads(request.body.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return HttpResponseBadRequest(JsonResponse({'error': 'Invalid JSON body'}))

        title = body.get('title', '').strip()
        if not title:
            return HttpResponseBadRequest(JsonResponse({'error': 'Title is required'}))

        priority = body.get('priority', 'medium')
        if priority not in ('low', 'medium', 'high'):
            priority = 'medium'

        category = body.get('category', 'General').strip() or 'General'
        description = body.get('description', '').strip()
        due_date = parse_date(body.get('due_date'))
        completed = bool(body.get('completed', False))

        todo = Todo.objects.create(
            title=title,
            description=description,
            category=category,
            priority=priority,
            due_date=due_date,
            completed=completed,
        )
        return JsonResponse(todo.to_dict(), status=201)

    return HttpResponseBadRequest(JsonResponse({'error': 'Method not allowed'}))


@csrf_exempt
def todo_detail_update_delete(request, todo_id):
    try:
        todo = Todo.objects.get(pk=todo_id)
    except Todo.DoesNotExist:
        return HttpResponseNotFound(JsonResponse({'error': 'Todo not found'}))

    if request.method == 'GET':
        return JsonResponse(todo.to_dict())

    elif request.method in ('PUT', 'PATCH'):
        try:
            body = json.loads(request.body.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return HttpResponseBadRequest(JsonResponse({'error': 'Invalid JSON body'}))

        if 'title' in body:
            title = body['title'].strip()
            if not title:
                return HttpResponseBadRequest(JsonResponse({'error': 'Title cannot be empty'}))
            todo.title = title

        if 'description' in body:
            todo.description = body['description'].strip()

        if 'category' in body:
            cat = body['category'].strip()
            if cat:
                todo.category = cat

        if 'priority' in body:
            p = body['priority']
            if p in ('low', 'medium', 'high'):
                todo.priority = p

        if 'due_date' in body:
            todo.due_date = parse_date(body['due_date'])

        if 'completed' in body:
            todo.completed = bool(body['completed'])

        todo.save()
        return JsonResponse(todo.to_dict())

    elif request.method == 'DELETE':
        todo.delete()
        return JsonResponse({'success': True, 'message': 'Todo deleted successfully'})

    return HttpResponseBadRequest(JsonResponse({'error': 'Method not allowed'}))


@csrf_exempt
def seed_sample_todos(request):
    """
    Seeds sample todos for instant exploration.
    """
    if request.method != 'POST':
        return HttpResponseBadRequest(JsonResponse({'error': 'POST method required'}))

    samples = [
        {
            'title': 'Check Paracetamol 500mg inventory',
            'description': 'Count remaining blister packs in emergency cabinet and update pharmacy registry.',
            'category': 'Health & Medicine',
            'priority': 'high',
            'due_date': date.today().isoformat(),
            'completed': False,
        },
        {
            'title': 'Restock Amoxicillin 250mg capsules',
            'description': 'Contact supplier MedCorp to reorder 50 boxes before weekend.',
            'category': 'Health & Medicine',
            'priority': 'medium',
            'due_date': None,
            'completed': False,
        },
        {
            'title': 'Review doctor prescription guidelines',
            'description': 'Verify new schedule for antibiotic dispensation and cold chain storage logs.',
            'category': 'Compliance',
            'priority': 'low',
            'due_date': None,
            'completed': True,
        },
        {
            'title': 'Calibrate temperature sensor in vaccine fridge',
            'description': 'Ensure digital thermometer is accurate within 2°C to 8°C limits.',
            'category': 'Equipment',
            'priority': 'high',
            'due_date': date.today().isoformat(),
            'completed': False,
        },
        {
            'title': 'Organize OTC cough syrup section',
            'description': 'Arrange by brand and generic name for faster patient checkout.',
            'category': 'Store Operation',
            'priority': 'medium',
            'due_date': None,
            'completed': True,
        },
    ]

    created_todos = []
    for item in samples:
        t = Todo.objects.create(
            title=item['title'],
            description=item['description'],
            category=item['category'],
            priority=item['priority'],
            due_date=parse_date(item['due_date']),
            completed=item['completed'],
        )
        created_todos.append(t.to_dict())

    return JsonResponse({
        'message': f'Seeded {len(created_todos)} sample tasks successfully!',
        'todos': created_todos
    }, status=201)


@csrf_exempt
def clear_completed_todos(request):
    if request.method != 'DELETE' and request.method != 'POST':
        return HttpResponseBadRequest(JsonResponse({'error': 'DELETE or POST method required'}))

    deleted_count, _ = Todo.objects.filter(completed=True).delete()
    return JsonResponse({'success': True, 'deleted_count': deleted_count})
