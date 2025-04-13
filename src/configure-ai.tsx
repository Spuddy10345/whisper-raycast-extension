import {
    ActionPanel,
    Action,
    Form,
    Icon,
    environment,
    Toast,
    showToast,
    LocalStorage,
    openExtensionPreferences,
    Color,
    List,
    confirmAlert,
    Alert,
    getPreferenceValues,
  } from "@raycast/api";
  import { useCallback, useState, useEffect } from "react";
  import { useCachedState } from "@raycast/utils";
  
  // Keys for LocalStorage
  const AI_PROMPTS_KEY = "aiPrompts";
  const ACTIVE_PROMPT_ID_KEY = "activePromptId";
  
  // preference interface
  interface Preferences {
    enableAIRefinement: boolean;
    aiModel: string;
  }
  
  // prompt interface
  interface AIPrompt {
    id: string;
    name: string;
    prompt: string;
  }
  
  export default function ConfigureAI() {
    // Check for Raycast Pro access
    const canAccessAI = environment.canAccess("AI");
    
    // Get user preference
    const preferences = getPreferenceValues<Preferences>();
    
    // Load saved prompts and active prompt ID
    const [prompts, setPrompts] = useCachedState<AIPrompt[]>("aiPrompts", [
      {
        id: "default",
        name: "Email Format",
        prompt: "Reformat this dictation as a professional email. Keep all facts and information from the original text, keep the wording similair just reformat and fix any grammatical errors. Add appropriate greeting and signature if needed, but don't include a subject.",
      },
      {
        id: "bullet",
        name: "Bullet Points",
        prompt: "Convert this dictation into concise bullet points. Preserve all key information.",
      },
      {
        id: "formal",
        name: "Formal Writing",
        prompt: "Rewrite this dictation in formal language suitable for professional documentation. Correct grammar and improve sentence structure while preserving all information.",
      },
      {
        id: "casual",
        name: "Casual Writing",
        prompt: "Rewrite this dictation in a casual tone suitable for informal communication. Maintain the original message while making it more conversational.",
      },
    ]);
    
    const [activePromptId, setActivePromptId] = useCachedState<string>(ACTIVE_PROMPT_ID_KEY, "default");
    const [isShowingPromptForm, setIsShowingPromptForm] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<AIPrompt | null>(null);
  
    // Save changes to LocalStorage
    useEffect(() => {
      LocalStorage.setItem(AI_PROMPTS_KEY, JSON.stringify(prompts));
    }, [prompts]);
  
    useEffect(() => {
      LocalStorage.setItem(ACTIVE_PROMPT_ID_KEY, activePromptId);
    }, [activePromptId]);
  
    const handleSetActivePrompt = useCallback((id: string) => {
      setActivePromptId(id);
      showToast({
        style: Toast.Style.Success,
        title: "Active prompt updated",
      });
    }, [setActivePromptId]);
  
    const handleDeletePrompt = useCallback(async (promptToDelete: AIPrompt) => {
      const shouldDelete = await confirmAlert({
        title: "Delete Prompt",
        message: `Are you sure you want to delete "${promptToDelete.name}"?`,
        primaryAction: {
          title: "Delete",
          style: Alert.ActionStyle.Destructive,
        },
      });
  
      if (shouldDelete) {
        // Remove the prompt
        const updatedPrompts = prompts.filter((p) => p.id !== promptToDelete.id);
        setPrompts(updatedPrompts);
        
        // If deleting the active prompt, set a new active prompt (first in the list)
        if (activePromptId === promptToDelete.id && updatedPrompts.length > 0) {
          setActivePromptId(updatedPrompts[0].id);
        }
        
        await showToast({
          style: Toast.Style.Success,
          title: "Prompt deleted",
        });
      }
    }, [prompts, setPrompts, activePromptId, setActivePromptId]);
  
    const handleSavePrompt = useCallback((newPrompt: AIPrompt) => {
      if (editingPrompt) {
        // Update existing prompt
        setPrompts(prompts.map((p) => (p.id === editingPrompt.id ? newPrompt : p)));
      } else {
        // Add new prompt
        setPrompts([...prompts, newPrompt]);
      }
      setIsShowingPromptForm(false);
      setEditingPrompt(null);
      showToast({
        style: Toast.Style.Success,
        title: editingPrompt ? "Prompt updated" : "Prompt added",
      });
    }, [prompts, setPrompts, editingPrompt]);
  
    // If user can't access AI (no raycast pro), show appropriate message
    if (!canAccessAI) {
      return (
        <List
          navigationTitle="Configure AI Refinement"
          searchBarPlaceholder=""
        >
          <List.EmptyView
            icon={{ source: Icon.Stars, tintColor: Color.Red }}
            title="Raycast Pro Required"
            description="AI refinement requires Raycast Pro. Upgrade to access this feature."
            actions={
              <ActionPanel>
                <Action.OpenInBrowser
                  title="Learn More"
                  url="https://www.raycast.com/pro"
                />
              </ActionPanel>
            }
          />
        </List>
      );
    }
  
    // Show form for creating/editing prompts
    if (isShowingPromptForm) {
      return (
        <Form
          navigationTitle={editingPrompt ? "Edit Prompt" : "Add Prompt"}
          actions={
            <ActionPanel>
              <Action.SubmitForm
                title={editingPrompt ? "Update Prompt" : "Add Prompt"}
                onSubmit={(values) => {
                  const newPrompt: AIPrompt = {
                    id: editingPrompt ? editingPrompt.id : Date.now().toString(),
                    name: values.name,
                    prompt: values.prompt,
                  };
                  handleSavePrompt(newPrompt);
                }}
              />
              <Action
                title="Cancel"
                icon={Icon.XMarkCircle}
                onAction={() => {
                  setIsShowingPromptForm(false);
                  setEditingPrompt(null);
                }}
                shortcut={{ modifiers: ["cmd"], key: "escape" }}
              />
            </ActionPanel>
          }
        >
          <Form.TextField
            id="name"
            title="Name"
            placeholder="E.g., Meeting Notes Format"
            defaultValue={editingPrompt?.name}
            autoFocus
          />
          <Form.TextArea
            id="prompt"
            title="Prompt"
            placeholder="Instructions for how AI should refine the transcription..."
            defaultValue={editingPrompt?.prompt}
          />
          <Form.Description
            title="Prompt Tips"
            text="Write clear instructions for how the AI should process the transcription. The transcribed text will be provided to the AI along with this prompt."
          />
        </Form>
      );
    }
  
    // Main list view of prompts
    return (
      <List
        navigationTitle="Configure AI Refinement"
        searchBarPlaceholder="Search prompts..."
      >
        <List.Section title="AI Refinement Status">
          <List.Item
            icon={
              preferences.enableAIRefinement
                ? { source: Icon.Checkmark, tintColor: Color.Green }
                : { source: Icon.XMarkCircle, tintColor: Color.Red }
            }
            title={preferences.enableAIRefinement ? "AI Refinement Enabled" : "AI Refinement Disabled"}
            subtitle={`Using ${preferences.aiModel.replace("OpenAI_", "").replace("Anthropic_", "")}`}
            accessories={[
              {
                tag: {
                  value: preferences.enableAIRefinement ? "Enabled" : "Disabled",
                  color: preferences.enableAIRefinement ? Color.Green : Color.Red,
                },
              },
            ]}
            actions={
              <ActionPanel>
                <Action
                  title="Open Extension Preferences"
                  icon={Icon.Gear}
                  onAction={openExtensionPreferences}
                />
              </ActionPanel>
            }
          />
        </List.Section>
  
        <List.Section title="Your Prompts">
          {prompts.map((prompt) => (
            <List.Item
              key={prompt.id}
              icon={
                activePromptId === prompt.id
                  ? { source: Icon.Checkmark, tintColor: Color.Green }
                  : { source: Icon.Document }
              }
              title={prompt.name}
              subtitle={prompt.prompt.length > 50 ? `${prompt.prompt.substring(0, 50)}...` : prompt.prompt}
              accessories={[
                ...(activePromptId === prompt.id ? [{ tag: { value: "Active", color: Color.Green } }] : []),
              ]}
              actions={
                <ActionPanel>
                  <Action
                    title="Set as Active Prompt"
                    icon={Icon.Checkmark}
                    onAction={() => handleSetActivePrompt(prompt.id)}
                  />
                  <Action
                    title="Edit Prompt"
                    icon={Icon.Pencil}
                    onAction={() => {
                      setEditingPrompt(prompt);
                      setIsShowingPromptForm(true);
                    }}
                    shortcut={{ modifiers: ["cmd"], key: "e" }}
                  />
                  <Action
                    title="Delete Prompt"
                    icon={Icon.Trash}
                    style={Action.Style.Destructive}
                    onAction={() => handleDeletePrompt(prompt)}
                    shortcut={{ modifiers: ["ctrl"], key: "x" }}
                  />
                </ActionPanel>
              }
            />
          ))}
          <List.Item
            icon={{ source: Icon.Plus, tintColor: Color.Blue }}
            title="Add New Prompt"
            actions={
              <ActionPanel>
                <Action
                  title="Add New Prompt"
                  icon={Icon.Plus}
                  onAction={() => {
                    setIsShowingPromptForm(true);
                    setEditingPrompt(null);
                  }}
                />
              </ActionPanel>
            }
          />
        </List.Section>
      </List>
    );
  }