import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { UserWarning } from './UserWarning';
import { TodoItem } from './components/TodoItem';
import {
  addTodo,
  deleteTodo,
  getTodos,
  updateTodo,
  USER_ID,
  TodoChanges,
} from './api/todos';
import { Todo } from './types/Todo';

enum Status {
  All = 'All',
  Active = 'Active',
  Completed = 'Completed',
}

type ErrorNotification = {
  message: string;
};

export const App: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [status, setStatus] = useState(Status.All);
  const [title, setTitle] = useState('');
  const [tempTodo, setTempTodo] = useState<Todo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<number[]>([]);
  const [error, setError] = useState<ErrorNotification | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const isAddingRef = useRef(false);
  const pendingIdsRef = useRef(new Set<number>());

  useEffect(() => {
    if (!USER_ID) {
      return;
    }

    let isCancelled = false;

    setError(null);

    getTodos()
      .then(loadedTodos => {
        if (!isCancelled) {
          setTodos(loadedTodos);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError({ message: 'Unable to load todos' });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError(null);
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [error]);

  useEffect(() => {
    if (!isLoading && !tempTodo) {
      inputRef.current?.focus();
    }
  }, [isLoading, tempTodo]);

  const startProcessing = (todoId: number) => {
    if (pendingIdsRef.current.has(todoId)) {
      return false;
    }

    pendingIdsRef.current.add(todoId);
    setProcessingIds(currentIds => [...currentIds, todoId]);
    setError(null);

    return true;
  };

  const finishProcessing = (todoId: number) => {
    pendingIdsRef.current.delete(todoId);

    setProcessingIds(currentIds => {
      return currentIds.filter(id => id !== todoId);
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isLoading || isAddingRef.current) {
      return;
    }

    const trimmedTitle = title.trim();

    setError(null);

    if (!trimmedTitle) {
      setError({ message: 'Title should not be empty' });
      inputRef.current?.focus();

      return;
    }

    isAddingRef.current = true;

    setTempTodo({
      id: 0,
      userId: USER_ID,
      title: trimmedTitle,
      completed: false,
    });

    try {
      const createdTodo = await addTodo(trimmedTitle);

      setTodos(currentTodos => [...currentTodos, createdTodo]);
      setTitle('');
    } catch {
      setError({ message: 'Unable to add a todo' });
    } finally {
      isAddingRef.current = false;
      setTempTodo(null);
    }
  };

  const handleDelete = async (todoId: number): Promise<boolean> => {
    if (!startProcessing(todoId)) {
      return false;
    }

    try {
      await deleteTodo(todoId);

      setTodos(currentTodos => {
        return currentTodos.filter(todo => todo.id !== todoId);
      });

      inputRef.current?.focus();

      return true;
    } catch {
      setError({ message: 'Unable to delete a todo' });

      return false;
    } finally {
      finishProcessing(todoId);
    }
  };

  const handleUpdate = async (
    todoId: number,
    changes: TodoChanges,
  ): Promise<boolean> => {
    if (!startProcessing(todoId)) {
      return false;
    }

    try {
      const updatedTodo = await updateTodo(todoId, changes);

      setTodos(currentTodos => {
        return currentTodos.map(todo => {
          if (todo.id !== todoId) {
            return todo;
          }

          return {
            ...todo,
            ...updatedTodo,
          };
        });
      });

      return true;
    } catch {
      setError({ message: 'Unable to update a todo' });

      return false;
    } finally {
      finishProcessing(todoId);
    }
  };

  const handleClearCompleted = () => {
    todos
      .filter(todo => todo.completed)
      .forEach(todo => {
        void handleDelete(todo.id);
      });
  };

  const handleToggleAll = () => {
    const completed = !todos.every(todo => todo.completed);

    todos
      .filter(todo => todo.completed !== completed)
      .forEach(todo => {
        void handleUpdate(todo.id, { completed });
      });
  };

  if (!USER_ID) {
    return <UserWarning />;
  }

  const activeTodosCount = todos.filter(todo => !todo.completed).length;
  const hasTodos = todos.length > 0;
  const hasCompletedTodos = todos.some(todo => todo.completed);
  const allTodosCompleted = hasTodos && activeTodosCount === 0;

  const visibleTodos = todos.filter(todo => {
    switch (status) {
      case Status.Active:
        return !todo.completed;

      case Status.Completed:
        return todo.completed;

      default:
        return true;
    }
  });

  return (
    <div className="todoapp">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {hasTodos && (
            <button
              type="button"
              className={classNames('todoapp__toggle-all', {
                active: allTodosCompleted,
              })}
              data-cy="ToggleAllButton"
              aria-label="Toggle all todos"
              disabled={processingIds.length > 0}
              onClick={handleToggleAll}
            />
          )}

          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              data-cy="NewTodoField"
              type="text"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={title}
              disabled={isLoading || tempTodo !== null}
              onChange={event => setTitle(event.target.value)}
            />
          </form>
        </header>

        {(hasTodos || tempTodo !== null) && (
          <section className="todoapp__main" data-cy="TodoList">
            {visibleTodos.map(todo => (
              <TodoItem
                key={todo.id}
                todo={todo}
                isLoading={processingIds.includes(todo.id)}
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            ))}

            {tempTodo && (
              <TodoItem
                key="temporary-todo"
                todo={tempTodo}
                isLoading
                onDelete={handleDelete}
                onUpdate={handleUpdate}
              />
            )}
          </section>
        )}

        {hasTodos && (
          <footer className="todoapp__footer" data-cy="Footer">
            <span className="todo-count" data-cy="TodosCounter">
              {activeTodosCount} items left
            </span>

            <nav className="filter" data-cy="Filter">
              <a
                href="#/"
                className={classNames('filter__link', {
                  selected: status === Status.All,
                })}
                data-cy="FilterLinkAll"
                onClick={() => setStatus(Status.All)}
              >
                All
              </a>

              <a
                href="#/active"
                className={classNames('filter__link', {
                  selected: status === Status.Active,
                })}
                data-cy="FilterLinkActive"
                onClick={() => setStatus(Status.Active)}
              >
                Active
              </a>

              <a
                href="#/completed"
                className={classNames('filter__link', {
                  selected: status === Status.Completed,
                })}
                data-cy="FilterLinkCompleted"
                onClick={() => setStatus(Status.Completed)}
              >
                Completed
              </a>
            </nav>

            <button
              type="button"
              className="todoapp__clear-completed"
              data-cy="ClearCompletedButton"
              disabled={!hasCompletedTodos}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={classNames(
          'notification is-danger is-light has-text-weight-normal',
          { hidden: !error },
        )}
      >
        <button
          data-cy="HideErrorButton"
          type="button"
          className="delete"
          aria-label="Close error notification"
          onClick={() => setError(null)}
        />

        {error?.message}
      </div>
    </div>
  );
};
