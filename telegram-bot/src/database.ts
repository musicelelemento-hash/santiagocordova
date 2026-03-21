import { supabase } from './supabase';

// Helper to convert PostgreSQL timestamp to JS Date/Number if needed
const toEpoch = (ts: string) => new Date(ts).getTime();

export interface MessageRow {
  id?: string;
  chat_id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any | null;
  tool_call_id?: string | null;
  name?: string | null;
  created_at?: string;
}

export async function saveMessage(chatId: string, role: string, content: string | null = null, toolCalls?: any, toolCallId?: string, name?: string) {
  try {
    // 1. Ensure chat exists
    await supabase.from('bot_chats').upsert({ id: chatId });

    // 2. Insert message
    const messageData: any = {
      chat_id: chatId,
      role: role,
      content: content,
      tool_calls: toolCalls ? JSON.stringify(toolCalls) : null,
      tool_call_id: toolCallId,
      name: name
    };

    const { error } = await supabase.from('bot_messages').insert(messageData);
    if (error) throw error;
  } catch (error) {
    console.error("Error saving message to Supabase:", error);
  }
}

export async function getChatHistory(chatId: string, limit: number = 50): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('bot_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    // Return in chronological order
    return data.reverse().map(row => {
      const msg: any = { role: row.role };
      if (row.content !== null) msg.content = row.content;
      if (row.tool_calls) msg.tool_calls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls;
      if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
      if (row.name) msg.name = row.name;
      return msg;
    });
  } catch (error) {
    console.error("Error fetching chat history from Supabase:", error);
    return [];
  }
}

export async function clearChatHistory(chatId: string) {
  try {
    const { error } = await supabase
      .from('bot_messages')
      .delete()
      .eq('chat_id', chatId);

    if (error) throw error;
    console.log(`Chat history for ${chatId} completely deleted from Supabase.`);
  } catch (error) {
    console.error("Error clearing chat history from Supabase:", error);
  }
}

export async function saveGmailToken(chatId: string, tokens: any) {
  try {
    const { error } = await supabase
      .from('bot_settings')
      .upsert({ 
        id: `gmail_${chatId}`, 
        data: tokens,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
  } catch (error) {
    console.error("Error saving Gmail token to Supabase:", error);
  }
}

export async function loadGmailToken(chatId: string): Promise<any> {
  try {
    const { data, error } = await supabase
      .from('bot_settings')
      .select('data')
      .eq('id', `gmail_${chatId}`)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data?.data;
  } catch (error) {
    console.error("Error loading Gmail token from Supabase:", error);
    return null;
  }
}

export async function saveMemory(chatId: string, content: string, category: 'preferencias' | 'semanal' | 'fiscal' | 'general' = 'general', monthsToKeep: number = 6) {
  try {
    const expiration = new Date();
    expiration.setMonth(expiration.getMonth() + monthsToKeep);

    const { error } = await supabase.from('bot_memories').insert({
      chat_id: chatId,
      content,
      category,
      expires_at: expiration.toISOString(),
      is_active: true
    });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Error saving memory to Supabase:", error);
    return false;
  }
}

export async function getMemories(chatId: string, limit: number = 15): Promise<any[]> {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('bot_memories')
      .select('*')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Error fetching memories from Supabase:", error);
    return [];
  }
}
